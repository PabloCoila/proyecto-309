/** Datos de la compañía activa (nombre y moneda) para UI y PDF. */
import type { OdooClient } from '../client';
import type { Many2One } from '../types';
import { safeCurrency } from '@/lib/format';

export interface CompanyInfo {
  id: number;
  name: string;
  currency: string;
  vat: string | false;
  street: string | false;
  city: string | false;
  phone: string | false;
}

interface CompanyRow {
  id: number;
  name: string;
  currency_id: Many2One;
  vat: string | false;
  street: string | false;
  city: string | false;
  phone: string | false;
}

export async function getCompanyInfo(client: OdooClient, companyId?: number | null): Promise<CompanyInfo> {
  let id = companyId ?? null;

  if (!id) {
    const [first] = await client.searchRead<{ id: number }>('res.company', { fields: ['id'], limit: 1 });
    id = first?.id ?? null;
  }

  if (!id) {
    return { id: 0, name: 'Neru', currency: 'USD', vat: false, street: false, city: false, phone: false };
  }

  const fields = ['name', 'currency_id', 'vat', 'street', 'city', 'phone'];
  const [company] = await client.read<CompanyRow>('res.company', [id], fields);
  return {
    id,
    name: company?.name ?? 'Neru',
    currency: safeCurrency(Array.isArray(company?.currency_id) ? company.currency_id[1] : null),
    vat: company?.vat ?? false,
    street: company?.street ?? false,
    city: company?.city ?? false,
    phone: company?.phone ?? false,
  };
}
