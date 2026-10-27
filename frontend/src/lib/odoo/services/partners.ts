/** Clientes (res.partner): consulta, alta y ranking de frecuencia. */
import type { OdooClient } from '../client';
import type { Domain, Partner, PartnerInput } from '../types';

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
  'sale_order_count',
  'is_company',
];

export interface PartnerQuery {
  search?: string;
  limit?: number;
  offset?: number;
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

  return client.searchRead<Partner>('res.partner', {
    domain,
    fields: PARTNER_FIELDS,
    limit,
    offset,
    order: 'name asc',
  });
}

/**
 * "Clientes más frecuentes": ordenados por número de ventas registradas.
 * sale_order_count es un campo calculado de res.partner (módulo sale).
 */
export async function listFrequentPartners(client: OdooClient, limit = 10): Promise<Partner[]> {
  return client.searchRead<Partner>('res.partner', {
    domain: [
      ['customer_rank', '>', 0],
      ['sale_order_count', '>', 0],
    ],
    fields: PARTNER_FIELDS,
    limit,
    order: 'sale_order_count desc, name asc',
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
