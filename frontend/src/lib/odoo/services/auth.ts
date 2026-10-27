/** Autenticación y datos del usuario activo. */
import type { OdooClient } from '../client';
import { OdooError } from '../errors';
import type { OdooUser, Many2One } from '../types';

export interface AuthResult {
  uid: number;
  user: OdooUser;
}

interface UserRow {
  id: number;
  name: string;
  login: string;
  lang: string;
  company_id: Many2One;
}

/**
 * Inicia sesión y devuelve el usuario con su compañía.
 * Odoo 17: common.login + lectura de res.users.
 */
export async function authenticate(
  client: OdooClient,
  credentials: { login: string; password: string },
): Promise<AuthResult> {
  const uid = await client.login(credentials.login, credentials.password);
  const user = await getCurrentUser(client, uid);
  return { uid, user };
}

/** Lee el usuario autenticado (usado al restaurar sesión). */
export async function getCurrentUser(client: OdooClient, uid: number): Promise<OdooUser> {
  const [row] = await client.read<UserRow>('res.users', [uid], ['name', 'login', 'lang', 'company_id']);

  if (!row) {
    throw new OdooError({ message: 'No se pudo leer el usuario autenticado.', kind: 'auth' });
  }

  return {
    id: row.id,
    name: row.name,
    login: row.login,
    lang: row.lang,
    company_id: row.company_id,
    company_name: Array.isArray(row.company_id) ? row.company_id[1] : 'Proyecto 309',
  };
}

/** Ping de conectividad + versión del servidor Odoo. */
export async function ping(client: OdooClient): Promise<string> {
  const version = await client.version();
  return version.server_version;
}
