/** Datos de la compañía activa (nombre y moneda) para UI y PDF. */
import type { OdooClient } from '../client';
import type { Many2One } from '../types';
import { safeCurrency } from '@/lib/format';

export interface CompanyInfo {
  id: number;
  name: string;
  currency: string;
}

interface CompanyRow {
  id: number;
  name: string;
  currency_id: Many2One;
}

export async function getCompanyInfo(client: OdooClient, companyId?: number | null): Promise<CompanyInfo> {
  let id = companyId ?? null;

  if (!id) {
    const [first] = await client.searchRead<{ id: number }>('res.company', { fields: ['id'], limit: 1 });
    id = first?.id ?? null;
  }

  if (!id) return { id: 0, name: 'Proyecto 309', currency: 'USD' };

  const [company] = await client.read<CompanyRow>('res.company', [id], ['name', 'currency_id']);
  return {
    id,
    name: company?.name ?? 'Proyecto 309',
    currency: safeCurrency(Array.isArray(company?.currency_id) ? company.currency_id[1] : null),
  };
}
