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
  name: 'Neru',
  short: 'NERU',
  tagline: 'Inventario & Punto de Venta',
} as const;

/**
 * Credenciales de demostración (visibles en el login para testeo local).
 * Sobrescribibles por .env — nunca usar en producción.
 */
export const DEMO_CREDENTIALS = {
  db: env.VITE_ODOO_DB ?? 'neru',
  login: env.VITE_ODOO_LOGIN ?? 'admin',
  password: env.VITE_ODOO_PASSWORD ?? 'admin',
} as const;

/**
 * Rellena el formulario con las credenciales demo solo en desarrollo.
 * En un build de producción los campos empiezan vacíos.
 */
export const DEMO_AUTOFILL = Boolean(
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV,
);

export const odooClientConfig: OdooClientConfig = {
  // "/odoo" lo resuelve el proxy de Vite hacia http://localhost:8069 (evita CORS).
  baseUrl: env.VITE_ODOO_BASE_URL ?? '/odoo',
  db: DEMO_CREDENTIALS.db,
  timeoutMs: 30_000,
};
