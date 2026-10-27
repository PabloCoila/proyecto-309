/** Configuración de la app (Vite env) y marca global. */
import type { OdooClientConfig } from './client';

type EnvBag = Record<string, string | undefined>;

function readEnv(): EnvBag {
  try {
    // En Fase 3 el proyecto Vite tipa esto con vite/client.
    return (import.meta as unknown as { env?: EnvBag }).env ?? {};
  } catch {
    return {};
  }
}

const env = readEnv();

export const BRAND = {
  name: 'Proyecto 309',
  short: 'P309',
  tagline: 'Inventario & Punto de Venta',
} as const;

/**
 * Credenciales de demostración (visibles en el login para testeo local).
 * Sobrescribibles por .env — nunca usar en producción.
 */
export const DEMO_CREDENTIALS = {
  db: env.VITE_ODOO_DB ?? 'proyecto309',
  login: env.VITE_ODOO_LOGIN ?? 'admin',
  password: env.VITE_ODOO_PASSWORD ?? 'admin',
} as const;

export const odooClientConfig: OdooClientConfig = {
  // "/odoo" lo resuelve el proxy de Vite hacia http://localhost:8069 (evita CORS).
  baseUrl: env.VITE_ODOO_BASE_URL ?? '/odoo',
  db: DEMO_CREDENTIALS.db,
  timeoutMs: 30_000,
};
