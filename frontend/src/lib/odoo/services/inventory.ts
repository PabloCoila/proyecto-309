/** Inventario y almacén: productos, ubicaciones y ajustes de stock. */
import type { OdooClient } from '../client';
import { OdooError, stripHtml } from '../errors';
import type { Domain, Product, StockLocation, StockQuant } from '../types';

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
];

export interface ProductQuery {
  search?: string;
  limit?: number;
  offset?: number;
  /** Solo productos con existencia > 0. */
  onlyWithStock?: boolean;
  order?: string;
}

/** Lista de productos con su existencia a mano. */
export async function listProducts(client: OdooClient, query: ProductQuery = {}): Promise<Product[]> {
  const { search = '', limit = 80, offset = 0, onlyWithStock = false, order = 'name asc' } = query;

  const domain: Domain = [];
  const term = search.trim();
  if (term) {
    domain.push('|', '|', ['name', 'ilike', term], ['default_code', 'ilike', term], ['barcode', 'ilike', term]);
  }
  if (onlyWithStock) domain.push(['qty_available', '>', 0]);

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
