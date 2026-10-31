/** Clientes (res.partner): consulta, alta y ranking de frecuencia. */
import type { OdooClient } from '../client';
import type { Domain, Many2One, Partner, PartnerInput } from '../types';

const PARTNER_FIELDS = [
  'name',
  'email',
  'phone',
  'mobile',
  'vat',
  'street',
  'city',
  'country_id',
  'customer_rank',
  'is_company',
];

export interface PartnerQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

interface InvoiceGroup {
  partner_id: Many2One;
  partner_id_count: number;
}

/**
 * Cuenta las facturas publicadas por cliente.
 * Es la fuente real del historial de compras: el POS de Neru emite
 * `account.move`, no pedidos de venta, así que `sale_order_count` queda en 0.
 */
async function invoiceCounts(
  client: OdooClient,
  partnerIds?: number[],
): Promise<Map<number, number>> {
  const domain: Domain = [
    ['move_type', '=', 'out_invoice'],
    ['state', '=', 'posted'],
  ];
  if (partnerIds && partnerIds.length > 0) domain.push(['partner_id', 'in', partnerIds]);

  const groups = await client.executeKw<InvoiceGroup[]>('account.move', 'read_group', [
    domain,
    ['partner_id'],
    ['partner_id'],
  ]);

  const counts = new Map<number, number>();
  for (const group of groups) {
    if (Array.isArray(group.partner_id)) {
      counts.set(group.partner_id[0], group.partner_id_count ?? 0);
    }
  }
  return counts;
}

/** Añade `invoice_count` a cada cliente con una sola consulta agregada. */
async function withInvoiceCounts(client: OdooClient, rows: Partner[]): Promise<Partner[]> {
  if (rows.length === 0) return rows;
  const counts = await invoiceCounts(client, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, invoice_count: counts.get(row.id) ?? 0 }));
}

/** Listado de clientes con búsqueda por nombre, email, teléfono o NIT. */
export async function listPartners(client: OdooClient, query: PartnerQuery = {}): Promise<Partner[]> {
  const { search = '', limit = 100, offset = 0 } = query;
  const domain: Domain = [];
  const term = search.trim();

  if (term) {
    domain.push('|', '|', '|', ['name', 'ilike', term], ['email', 'ilike', term], ['phone', 'ilike', term], ['vat', 'ilike', term]);
  } else {
    domain.push(['customer_rank', '>', 0]);
  }

  const rows = await client.searchRead<Partner>('res.partner', {
    domain,
    fields: PARTNER_FIELDS,
    limit,
    offset,
    order: 'name asc',
  });

  return withInvoiceCounts(client, rows);
}

/**
 * "Clientes más frecuentes": ordenados por facturas publicadas.
 * Usa `account.move` porque las ventas de Neru no crean pedidos de venta.
 */
export async function listFrequentPartners(client: OdooClient, limit = 10): Promise<Partner[]> {
  const counts = await invoiceCounts(client);
  const top = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, limit);

  if (top.length === 0) return [];

  const rows = await client.read<Partner>(
    'res.partner',
    top.map(([id]) => id),
    PARTNER_FIELDS,
  );
  const byId = new Map(rows.map((row) => [row.id, row]));

  return top.flatMap(([id, count]) => {
    const partner = byId.get(id);
    return partner ? [{ ...partner, invoice_count: count }] : [];
  });
}

/** Alta rápida de cliente. */
export async function createPartner(client: OdooClient, input: PartnerInput): Promise<number> {
  const values: Record<string, unknown> = {
    name: input.name.trim(),
    customer_rank: 1,
    is_company: input.isCompany ?? false,
  };

  if (input.email?.trim()) values.email = input.email.trim();
  if (input.phone?.trim()) values.phone = input.phone.trim();
  if (input.vat?.trim()) values.vat = input.vat.trim();
  if (input.street?.trim()) values.street = input.street.trim();
  if (input.city?.trim()) values.city = input.city.trim();

  // `type` mantiene compatibilidad con integraciones externas que aún lo leen.
  values.type = 'contact';

  return client.create('res.partner', values);
}

/** Datos completos de un cliente. */
export async function getPartner(client: OdooClient, partnerId: number): Promise<Partner | null> {
  const [partner] = await client.read<Partner>('res.partner', [partnerId], PARTNER_FIELDS);
  return partner ?? null;
}

/** Total de clientes registrados (para contadores de UI). */
export async function countPartners(client: OdooClient): Promise<number> {
  return client.searchCount('res.partner', [['customer_rank', '>', 0]]);
}

/** Total de facturas de cliente publicadas (para contadores de UI). */
export async function countCustomerInvoices(client: OdooClient): Promise<number> {
  return client.searchCount('account.move', [
    ['move_type', '=', 'out_invoice'],
    ['state', '=', 'posted'],
  ]);
}
