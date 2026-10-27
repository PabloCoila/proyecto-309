/**
 * Errores normalizados del cliente Odoo.
 * Odoo devuelve mensajes con HTML (<p>, <br>) en UserError/ValidationError.
 */

export type OdooErrorKind = 'connection' | 'auth' | 'rpc' | 'server';

export interface OdooErrorInit {
  message: string;
  kind?: OdooErrorKind;
  code?: string | number;
  odooName?: string;
  debug?: string;
  status?: number;
}

export class OdooError extends Error {
  readonly kind: OdooErrorKind;
  readonly code?: string | number;
  readonly odooName?: string;
  readonly debug?: string;
  readonly status?: number;

  constructor(init: OdooErrorInit) {
    super(init.message);
    this.name = 'OdooError';
    this.kind = init.kind ?? 'rpc';
    this.code = init.code;
    this.odooName = init.odooName;
    this.debug = init.debug;
    this.status = init.status;
  }
}

/** Limpia el HTML que Odoo inyecta en los mensajes de excepción. */
export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toOdooError(error: unknown): OdooError {
  if (error instanceof OdooError) return error;
  if (error instanceof Error) {
    return new OdooError({ message: error.message, kind: 'connection' });
  }
  return new OdooError({ message: String(error), kind: 'rpc' });
}

/** Mensaje apto para mostrar en la UI. */
export function friendlyMessage(error: unknown): string {
  const err = toOdooError(error);

  if (err.kind === 'connection') {
    return 'No se pudo conectar con Odoo. Verifica que el contenedor esté activo (docker compose up -d).';
  }
  if (err.kind === 'auth') return err.message;

  const name = err.odooName ?? '';
  if (name.includes('AccessDenied') || name.includes('AccessError')) {
    return 'Tu usuario no tiene permisos para realizar esta operación en Odoo.';
  }
  if (name.includes('MissingError')) return 'El registro ya no existe en Odoo.';
  if (name.includes('ValidationError') || name.includes('UserError')) {
    return stripHtml(err.message);
  }
  return stripHtml(err.message) || 'Odoo devolvió un error inesperado.';
}
