/** Ventas: factura (account.move) y pedido (sale.order). */
import type { OdooClient } from '../client';
import { OdooError } from '../errors';
import type { CartLine, Invoice, SaleInput, SaleOrder } from '../types';
import {
  cancelStockDelivery,
  prepareStockDelivery,
  reserveStockDelivery,
  validateStockDelivery,
} from './inventory';
import type { StockReservation } from './inventory';

const INVOICE_FIELDS = [
  'name',
  'state',
  'amount_untaxed',
  'amount_tax',
  'amount_total',
  'invoice_date',
  'partner_id',
  'currency_id',
  'payment_state',
];

function assertLines(lines: CartLine[]): void {
  if (lines.length === 0) throw new OdooError({ message: 'La orden no tiene líneas de producto.' });
  for (const line of lines) {
    if (!line.productId) throw new OdooError({ message: 'Hay una línea sin producto.' });
    if (!(line.quantity > 0)) throw new OdooError({ message: 'Las cantidades deben ser mayores a cero.' });
    if (line.unitPrice < 0) throw new OdooError({ message: 'El precio no puede ser negativo.' });
  }
}

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Crea y publica una factura de cliente en Odoo y descuenta el stock.
 *
 * Flujo:
 *  1. Valida disponibilidad y prepara la salida (sin escribir nada).
 *  2. Reserva el albarán de salida (stock.picking + action_assign).
 *  3. Crea y publica la factura (account.move + action_post).
 *  4. Valida el albarán, que descuenta `qty_available` / `free_qty`.
 *
 * Si un paso falla, se compensan los anteriores (cancelar albarán y revertir
 * la factura) para no dejar ventas sin inventario ni reservas huérfanas.
 * Los totales devueltos son los calculados por Odoo (impuestos incluidos).
 */
export async function createInvoice(
  client: OdooClient,
  input: SaleInput & { invoiceDate?: string },
): Promise<Invoice> {
  assertLines(input.lines);

  const delivery = await prepareStockDelivery(
    client,
    input.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  );

  let reservation: StockReservation | null = null;
  let moveId: number | null = null;

  try {
    if (delivery) reservation = await reserveStockDelivery(client, delivery);

    moveId = await client.create('account.move', {
      move_type: 'out_invoice',
      partner_id: input.partnerId,
      invoice_date: input.invoiceDate ?? localDate(),
      invoice_line_ids: input.lines.map((line) => [
        0,
        0,
        {
          product_id: line.productId,
          quantity: line.quantity,
          price_unit: line.unitPrice,
          ...(line.description ? { name: line.description } : {}),
        },
      ]),
      ...(input.note ? { narration: input.note } : {}),
    });

    await client.callButton('account.move', 'action_post', [moveId]);
  } catch (error) {
    if (reservation) await cancelStockDelivery(client, reservation);
    if (moveId) await discardInvoice(client, moveId);
    throw error;
  }

  const [invoice] = await client.read<Invoice>('account.move', [moveId], INVOICE_FIELDS);
  if (!invoice) {
    if (reservation) await cancelStockDelivery(client, reservation);
    await discardInvoice(client, moveId);
    throw new OdooError({ message: 'La factura se creó pero no pudo leerse.' });
  }

  if (reservation) {
    const invoiceRef = `Factura ${invoice.name || invoice.id}`;
    try {
      await client.write('stock.picking', [reservation.pickingId], { origin: invoiceRef });
    } catch {
      /* la referencia del albarán es informativa */
    }

    try {
      await validateStockDelivery(client, reservation);
    } catch (cause) {
      const discarded = await discardInvoice(client, moveId);
      await cancelStockDelivery(client, reservation);
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new OdooError({
        message: discarded
          ? `No se pudo registrar la salida de stock, así que la factura no se emitió. ${detail}`
          : `La factura ${invoice.name || invoice.id} quedó publicada, pero el stock no se descontó. Corrige la salida en Odoo. ${detail}`,
      });
    }
  }

  return invoice;
}

/**
 * Registra el pago total de una factura publicada con el asistente estándar
 * de Odoo (`account.payment.register`). Si falla, la factura queda impaga:
 * nunca se altera el asiento ya emitido.
 */
export async function registerInvoicePayment(
  client: OdooClient,
  invoiceId: number,
  amount: number,
  method: 'cash' | 'bank',
): Promise<void> {
  if (amount <= 0) return;

  const journals = await client.searchRead<{ id: number; type: string }>('account.journal', {
    domain: [['type', 'in', ['cash', 'bank']]],
    fields: ['id', 'type'],
    limit: 50,
  });
  const journal = journals.find((row) => row.type === method) ?? journals[0];
  if (!journal) {
    throw new OdooError({ message: 'No hay un diario de efectivo o banco configurado en Odoo.' });
  }

  const context = { active_model: 'account.move', active_ids: [invoiceId] };
  const wizardId = await client.executeKw<number>(
    'account.payment.register',
    'create',
    [{ payment_date: localDate(), amount, journal_id: journal.id }],
    { context },
  );
  await client.executeKw('account.payment.register', 'action_create_payments', [[wizardId]], { context });
}

/** Revierte una factura recién creada; devuelve true si logró eliminarla. */async function discardInvoice(client: OdooClient, invoiceId: number): Promise<boolean> {
  try {
    await client.callButton('account.move', 'button_draft', [invoiceId]);
  } catch {
    /* si el asiento no permite volver a borrador, se intenta eliminar igual */
  }
  try {
    await client.unlink('account.move', [invoiceId]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea y confirma un pedido de venta (reserva stock).
 * Útil cuando el flujo requiere preparación/entrega física.
 */
export async function createSaleOrder(
  client: OdooClient,
  input: SaleInput,
): Promise<SaleOrder & { amount_untaxed: number; amount_tax: number }> {
  assertLines(input.lines);

  const orderId = await client.create('sale.order', {
    partner_id: input.partnerId,
    ...(input.note ? { note: input.note } : {}),
    order_line: input.lines.map((line) => [
      0,
      0,
      {
        product_id: line.productId,
        product_uom_qty: line.quantity,
        price_unit: line.unitPrice,
        ...(line.description ? { name: line.description } : {}),
      },
    ]),
  });

  await client.callButton('sale.order', 'action_confirm', [orderId]);

  const [order] = await client.read<SaleOrder & { amount_untaxed: number; amount_tax: number }>(
    'sale.order',
    [orderId],
    ['name', 'state', 'amount_untaxed', 'amount_tax', 'amount_total', 'partner_id'],
  );
  if (!order) throw new OdooError({ message: 'El pedido se creó pero no pudo leerse.' });
  return order;
}

/** Facturas recientes para el historial del punto de venta. */
export async function listRecentInvoices(client: OdooClient, limit = 20): Promise<Invoice[]> {
  return client.searchRead<Invoice>('account.move', {
    domain: [
      ['move_type', '=', 'out_invoice'],
      ['state', 'in', ['posted', 'draft']],
    ],
    fields: INVOICE_FIELDS,
    order: 'id desc',
    limit,
  });
}

/** Líneas detalladas de una factura (para el PDF). */
export async function getInvoiceLines(
  client: OdooClient,
  invoiceId: number,
): Promise<Array<{ id: number; name: string; quantity: number; price_unit: number; price_subtotal: number }>> {
  return client.searchRead(
    'account.move.line',
    {
      domain: [
        ['move_id', '=', invoiceId],
        ['display_type', '=', 'product'],
      ],
      fields: ['name', 'quantity', 'price_unit', 'price_subtotal'],
      order: 'id asc',
    },
  );
}

/** Datos de una factura puntual. */
export async function getInvoice(client: OdooClient, invoiceId: number): Promise<Invoice | null> {
  const [invoice] = await client.read<Invoice>('account.move', [invoiceId], INVOICE_FIELDS);
  return invoice ?? null;
}
