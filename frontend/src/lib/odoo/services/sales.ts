/** Ventas: factura (account.move) y pedido (sale.order). */
import type { OdooClient } from '../client';
import { OdooError } from '../errors';
import type { CartLine, Invoice, SaleInput, SaleOrder } from '../types';

const INVOICE_FIELDS = [
  'name',
  'state',
  'amount_untaxed',
  'amount_tax',
  'amount_total',
  'invoice_date',
  'partner_id',
  'currency_id',
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
 * Crea y publica una factura de cliente en Odoo.
 * Los totales devueltos son los calculados por Odoo (impuestos incluidos).
 */
export async function createInvoice(
  client: OdooClient,
  input: SaleInput & { invoiceDate?: string },
): Promise<Invoice> {
  assertLines(input.lines);

  const moveId = await client.create('account.move', {
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

  const [invoice] = await client.read<Invoice>('account.move', [moveId], INVOICE_FIELDS);
  if (!invoice) throw new OdooError({ message: 'La factura se creó pero no pudo leerse.' });
  return invoice;
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
