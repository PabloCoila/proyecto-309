/**
 * Proyecto 309 — API de Odoo (headless).
 *
 * Uso:
 *   import { getOdooClient, auth, inventory } from '@/lib/odoo';
 *   await auth.authenticate(getOdooClient(), DEMO_CREDENTIALS);
 *   const productos = await inventory.listProducts(getOdooClient(), { limit: 20 });
 */
import { OdooClient } from './client';
import { odooClientConfig } from './config';

export { OdooClient } from './client';
export type { OdooClientConfig } from './client';
export { OdooError, friendlyMessage, stripHtml, toOdooError } from './errors';
export type { OdooErrorKind } from './errors';
export { BRAND, DEMO_CREDENTIALS, odooClientConfig } from './config';
export { clearSession, loadSession, saveSession } from './session';
export type { StoredSession } from './session';

export * as auth from './services/auth';
export * as inventory from './services/inventory';
export * as partners from './services/partners';
export * as sales from './services/sales';
export * as company from './services/company';

export type * from './types';

let singleton: OdooClient | null = null;

/** Cliente único de la app (uid y credenciales viven en memoria). */
export function getOdooClient(): OdooClient {
  if (!singleton) singleton = new OdooClient(odooClientConfig);
  return singleton;
}

/** Solo para tests: permite inyectar otra configuración. */
export function resetOdooClient(): void {
  singleton = null;
}
