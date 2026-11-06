/** Inventario y almacén: productos, ubicaciones y ajustes de stock. */
import type { OdooClient } from '../client';
import { OdooError, stripHtml } from '../errors';
import type { Domain, Many2One, Product, StockLocation, StockQuant } from '../types';

const PRODUCT_FIELDS = [
  'name',
  'default_code',
  'barcode',
  'qty_available',
  'virtual_available',
  'free_qty',
  'uom_id',
  'categ_id',
  'list_price',
  'standard_price',
  'detailed_type',
  'type',
  'image_128',
];

export interface ProductQuery {
  search?: string;
  limit?: number;
  offset?: number;
  /** Solo productos con existencia > 0. */
  onlyWithStock?: boolean;
  /** Solo productos almacenables (excluye servicios y consumibles). */
  stockableOnly?: boolean;
  order?: string;
}

/** Datos para crear un producto nuevo. */
export interface ProductInput {
  name: string;
  default_code?: string;
  /** Tipo de producto: almacenable, consumible o servicio. */
  detailed_type?: 'product' | 'consu' | 'service';
  size?: string;
  description?: string;
  list_price: number;
}

/** Crea un producto nuevo en Odoo (product.template). */
export async function createProduct(client: OdooClient, input: ProductInput): Promise<number> {
  return client.create('product.template', {
    name: input.name.trim(),
    default_code: input.default_code?.trim() ?? false,
    detailed_type: input.detailed_type ?? 'product',
    list_price: input.list_price,
    sale_ok: true,
    purchase_ok: true,
    ...(input.description ? { description: input.description.trim() } : {}),
    ...(input.size ? { description_sale: input.size.trim() } : {}),
  });
}

/** Lista de productos con su existencia a mano. */
export async function listProducts(client: OdooClient, query: ProductQuery = {}): Promise<Product[]> {
  const { search = '', limit = 80, offset = 0, onlyWithStock = false, stockableOnly = false, order = 'name asc' } = query;

  const domain: Domain = [];
  const term = search.trim();
  if (term) {
    domain.push('|', '|', ['name', 'ilike', term], ['default_code', 'ilike', term], ['barcode', 'ilike', term]);
  }
  if (onlyWithStock) domain.push(['qty_available', '>', 0]);
  if (stockableOnly) domain.push(['detailed_type', '=', 'product']);

  return client.searchRead<Product>('product.product', {
    domain,
    fields: PRODUCT_FIELDS,
    limit,
    offset,
    order,
  });
}

/** Ubicaciones internas del almacén (seleccionables para movimientos). */
export async function listStockLocations(client: OdooClient): Promise<StockLocation[]> {
  return client.searchRead<StockLocation>('stock.location', {
    domain: [['usage', '=', 'internal']],
    fields: ['complete_name', 'usage', 'location_id', 'warehouse_id'],
    order: 'complete_name asc',
    limit: 100,
  });
}

/** Detalle por ubicación de un producto (o de todo el almacén). */
export async function listQuants(client: OdooClient, productId?: number): Promise<StockQuant[]> {
  const domain: Domain = [];
  if (productId) domain.push(['product_id', '=', productId]);

  return client.searchRead<StockQuant>('stock.quant', {
    domain,
    fields: ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
    order: 'location_id asc',
    limit: 200,
  });
}

export interface StockAdjustment {
  productId: number;
  locationId: number;
  /** Nueva cantidad absoluta en esa ubicación. */
  quantity: number;
}

/**
 * Fija la cantidad exacta de un producto en una ubicación mediante un ajuste
 * de inventario (stock.quant + action_apply_inventory).
 * Devuelve la cantidad resultante según Odoo (fuente de verdad).
 */
export async function setStockQuantity(client: OdooClient, input: StockAdjustment): Promise<number> {
  const { productId, locationId, quantity } = input;
  if (quantity < 0) throw new OdooError({ message: 'La cantidad no puede ser negativa.' });

  const [existing] = await client.searchRead<{ id: number }>('stock.quant', {
    domain: [
      ['product_id', '=', productId],
      ['location_id', '=', locationId],
    ] as Domain,
    fields: ['id'],
    limit: 1,
  });

  const quantId = existing
    ? existing.id
    : await client.create('stock.quant', {
        product_id: productId,
        location_id: locationId,
        inventory_quantity: quantity,
        inventory_quantity_set: true,
      });

  if (existing) {
    await client.write('stock.quant', [quantId], {
      inventory_quantity: quantity,
      inventory_quantity_set: true,
    });
  }

  try {
    await client.callButton('stock.quant', 'action_apply_inventory', [quantId]);
  } catch (error) {
    throw new OdooError({
      message: stripHtml(error instanceof Error ? error.message : String(error)),
      kind: 'rpc',
    });
  }

  const [applied] = await client.read<{ quantity: number }>('stock.quant', [quantId], ['quantity']);
  return applied?.quantity ?? quantity;
}

/** Registra una entrada (delta positivo) o salida (delta negativo) de stock. */
export async function moveStock(
  client: OdooClient,
  input: { productId: number; locationId: number; delta: number },
): Promise<number> {
  const [current] = await client.searchRead<{ quantity: number }>('stock.quant', {
    domain: [
      ['product_id', '=', input.productId],
      ['location_id', '=', input.locationId],
    ] as Domain,
    fields: ['quantity'],
    limit: 1,
  });

  const next = (current?.quantity ?? 0) + input.delta;
  return setStockQuantity(client, { ...input, quantity: next });
}

/** Resumen para el dashboard de inventario. */
export async function getInventorySummary(client: OdooClient): Promise<{
  products: number;
  locations: number;
  quants: number;
}> {
  const [products, locations, quants] = await Promise.all([
    client.searchCount('product.product', [['detailed_type', '=', 'product']]),
    client.searchCount('stock.location', [['usage', '=', 'internal']]),
    client.searchCount('stock.quant', [['quantity', '!=', 0]]),
  ]);
  return { products, locations, quants };
}

/* ------------------------- Salidas de stock (ventas) ------------------------ */

export interface StockLineInput {
  productId: number;
  quantity: number;
}

export interface StockLine extends StockLineInput {
  name: string;
  uomId: number;
}

interface ProductStockRow {
  id: number;
  name: string;
  detailed_type?: string;
  type?: string;
  free_qty?: number;
  qty_available?: number;
  uom_id: Many2One;
}

interface PickingTypeRow {
  id: number;
  name: string;
  default_location_src_id: Many2One;
  default_location_dest_id: Many2One;
}

interface StockMoveRow {
  id: number;
  name: string;
  product_uom_qty: number;
  quantity: number;
}

/** Plan de salida calculado antes de tocar datos (productos + ubicaciones). */
export interface StockDeliveryPlan {
  lines: StockLine[];
  pickingTypeId: number;
  sourceLocationId: number;
  destinationLocationId: number;
}

/** Albarán confirmado y reservado, pendiente de validar. */
export interface StockReservation {
  pickingId: number;
  pickingName: string;
  moves: Array<{ id: number; name: string; quantity: number }>;
}

function isStorable(product: ProductStockRow): boolean {
  return (product.detailed_type ?? product.type) === 'product';
}

/**
 * Valida existencias y prepara la salida de almacén para una venta.
 *
 * - Agrupa líneas repetidas por producto.
 * - Ignora servicios y consumibles (no manejan cantidades en `stock.quant`).
 * - Falla con un mensaje claro si no hay disponibilidad suficiente.
 * - Devuelve `null` cuando la orden solo tiene conceptos sin stock.
 *
 * No escribe nada en Odoo: es seguro llamarlo antes de crear la factura.
 */
export async function prepareStockDelivery(
  client: OdooClient,
  lines: StockLineInput[],
): Promise<StockDeliveryPlan | null> {
  const grouped = new Map<number, number>();
  for (const line of lines) {
    if (!line.productId || !(line.quantity > 0)) continue;
    grouped.set(line.productId, (grouped.get(line.productId) ?? 0) + line.quantity);
  }
  if (grouped.size === 0) return null;

  const products = await client.read<ProductStockRow>('product.product', [...grouped.keys()], [
    'name',
    'detailed_type',
    'type',
    'free_qty',
    'qty_available',
    'uom_id',
  ]);
  const byId = new Map(products.map((product) => [product.id, product]));

  const stockLines: StockLine[] = [];
  const shortages: string[] = [];

  for (const [productId, quantity] of grouped) {
    const product = byId.get(productId);
    if (!product) {
      throw new OdooError({ message: 'Uno de los productos de la orden ya no existe en Odoo.' });
    }
    if (!isStorable(product)) continue;
    if (!Array.isArray(product.uom_id)) {
      throw new OdooError({ message: `El producto ${product.name} no tiene unidad de medida configurada.` });
    }

    const available = Number(product.free_qty ?? product.qty_available ?? 0);
    if (quantity > available + 1e-6) {
      shortages.push(`${product.name}: pedido ${quantity}, disponible ${available}`);
      continue;
    }

    stockLines.push({ productId, quantity, name: product.name, uomId: product.uom_id[0] });
  }

  if (shortages.length > 0) {
    throw new OdooError({
      message: `Stock insuficiente. ${shortages.join(' · ')}. Ajusta el inventario antes de emitir la factura.`,
    });
  }
  if (stockLines.length === 0) return null;

  const [pickingType] = await client.searchRead<PickingTypeRow>('stock.picking.type', {
    domain: [['code', '=', 'outgoing']],
    fields: ['name', 'default_location_src_id', 'default_location_dest_id'],
    order: 'sequence asc, id asc',
    limit: 1,
  });
  if (!pickingType) {
    throw new OdooError({
      message: 'Odoo no tiene un tipo de operación de salida configurado (Inventario → Operaciones).',
    });
  }

  const sourceLocationId = Array.isArray(pickingType.default_location_src_id)
    ? pickingType.default_location_src_id[0]
    : null;
  let destinationLocationId = Array.isArray(pickingType.default_location_dest_id)
    ? pickingType.default_location_dest_id[0]
    : null;

  if (!destinationLocationId) {
    const [customerLocation] = await client.searchRead<{ id: number }>('stock.location', {
      domain: [['usage', '=', 'customer']],
      fields: ['id'],
      order: 'id asc',
      limit: 1,
    });
    destinationLocationId = customerLocation?.id ?? null;
  }

  if (!sourceLocationId || !destinationLocationId) {
    throw new OdooError({
      message: 'La operación de salida de Odoo no tiene ubicaciones de origen/destino configuradas.',
    });
  }

  return {
    lines: stockLines,
    pickingTypeId: pickingType.id,
    sourceLocationId,
    destinationLocationId,
  };
}

/**
 * Crea, confirma y reserva el albarán de salida. Si algo falla, intenta
 * cancelarlo para no dejar reservas huérfanas.
 */
export async function reserveStockDelivery(
  client: OdooClient,
  plan: StockDeliveryPlan,
  origin = 'Neru POS',
): Promise<StockReservation> {
  let pickingId: number | null = null;

  try {
    pickingId = await client.create('stock.picking', {
      picking_type_id: plan.pickingTypeId,
      location_id: plan.sourceLocationId,
      location_dest_id: plan.destinationLocationId,
      origin,
      move_ids_without_package: plan.lines.map((line) => [
        0,
        0,
        {
          name: line.name,
          product_id: line.productId,
          product_uom_qty: line.quantity,
          product_uom: line.uomId,
          location_id: plan.sourceLocationId,
          location_dest_id: plan.destinationLocationId,
        },
      ]),
    });

    await client.callButton('stock.picking', 'action_confirm', [pickingId]);
    await client.callButton('stock.picking', 'action_assign', [pickingId]);

    const moves = await client.searchRead<StockMoveRow>('stock.move', {
      domain: [['picking_id', '=', pickingId]],
      fields: ['name', 'product_uom_qty', 'quantity'],
    });

    const pending = moves.filter((move) => move.quantity + 1e-6 < move.product_uom_qty);
    if (pending.length > 0) {
      throw new OdooError({
        message: `No se pudo reservar todo el stock: ${pending.map((move) => move.name).join(', ')}.`,
      });
    }

    const [picking] = await client.read<{ name: string }>('stock.picking', [pickingId], ['name']);
    return {
      pickingId,
      pickingName: picking?.name ?? `#${pickingId}`,
      moves: moves.map((move) => ({
        id: move.id,
        name: move.name,
        quantity: move.product_uom_qty,
      })),
    };
  } catch (error) {
    if (pickingId) await cancelStockDelivery(client, { pickingId });
    throw error;
  }
}

/**
 * Marca todas las líneas como surtidas y valida el albarán.
 * Al terminar, `qty_available` y `free_qty` reflejan la venta.
 */
export async function validateStockDelivery(
  client: OdooClient,
  reservation: StockReservation,
): Promise<void> {
  for (const move of reservation.moves) {
    await client.write('stock.move', [move.id], { quantity: move.quantity, picked: true });
  }

  await client.callButton('stock.picking', 'button_validate', [reservation.pickingId], {
    context: { skip_backorder: true },
  });

  const [picking] = await client.read<{ state: string }>('stock.picking', [reservation.pickingId], [
    'state',
  ]);
  if (picking?.state !== 'done') {
    throw new OdooError({
      message: `Odoo no confirmó la salida de stock (estado: ${picking?.state ?? 'desconocido'}).`,
    });
  }
}

/** Cancela un albarán aún no validado. Nunca lanza: es una compensación. */
export async function cancelStockDelivery(
  client: OdooClient,
  reservation: { pickingId: number },
): Promise<void> {
  try {
    const [picking] = await client.read<{ state: string }>('stock.picking', [reservation.pickingId], [
      'state',
    ]);
    if (!picking || picking.state === 'done' || picking.state === 'cancel') return;
    await client.callButton('stock.picking', 'action_cancel', [reservation.pickingId]);
  } catch {
    /* la compensación es best-effort */
  }
}

