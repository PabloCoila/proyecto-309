/**
 * Cliente JSON-RPC de Odoo (núcleo).
 *
 * Endpoint: POST {baseUrl}/jsonrpc
 *  - common.login  -> uid
 *  - object.execute_kw -> ORM (search_read, create, write, action_* ...)
 *
 * Nota de despliegue: en dev usamos baseUrl "/odoo" y un proxy de Vite hacia
 * http://localhost:8069 para evitar CORS (Odoo no envía cabeceras CORS).
 */
import { OdooError, stripHtml, toOdooError } from './errors';
import type { Domain, OdooRecord, OdooVersion, SearchReadOptions } from './types';

export interface OdooClientConfig {
  /** Prefijo de la API, p. ej. "/odoo" (proxy) o "http://localhost:8069". */
  baseUrl: string;
  /** Nombre de la base de datos, p. ej. "proyecto309". */
  db: string;
  /** Timeout por petición en ms. */
  timeoutMs?: number;
}

type RpcService = 'common' | 'object' | 'report';

interface RpcErrorBody {
  code: number;
  message: string;
  data?: {
    name?: string;
    message?: string;
    debug?: string;
    arguments?: unknown[];
  };
}

interface RpcResponse<T> {
  jsonrpc: '2.0';
  id: number | null;
  result?: T;
  error?: RpcErrorBody;
}

export class OdooClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private uidValue: number | null = null;
  private passwordValue: string | null = null;
  private rpcSeq = 0;

  readonly db: string;

  constructor(config: OdooClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.db = config.db;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  get uid(): number | null {
    return this.uidValue;
  }

  get isAuthenticated(): boolean {
    return this.uidValue !== null;
  }

  /** Credenciales activas (para persistir la sesión en el navegador). */
  get credentials(): { db: string; uid: number; password: string } | null {
    if (this.uidValue === null || this.passwordValue === null) return null;
    return { db: this.db, uid: this.uidValue, password: this.passwordValue };
  }

  clearCredentials(): void {
    this.uidValue = null;
    this.passwordValue = null;
  }

  /** Versión del servidor Odoo (no requiere autenticación). */
  async version(): Promise<OdooVersion> {
    return this.rpc<OdooVersion>('common', 'version', []);
  }

  /**
   * Autentica contra Odoo y guarda uid + contraseña para execute_kw.
   * @throws OdooError kind "auth" si las credenciales son incorrectas.
   */
  async login(login: string, password: string): Promise<number> {
    let uid: number | false;
    try {
      uid = await this.rpc<number | false>('common', 'login', [this.db, login, password]);
    } catch (error) {
      const err = toOdooError(error);
      if (err.kind === 'connection') throw err;
      throw new OdooError({
        message: stripHtml(err.message) || 'No se pudo autenticar contra Odoo.',
        kind: 'auth',
        odooName: err.odooName,
      });
    }

    if (!uid) {
      throw new OdooError({
        message: 'Usuario o contraseña incorrectos, o la base de datos no existe.',
        kind: 'auth',
      });
    }

    this.uidValue = uid;
    this.passwordValue = password;
    return uid;
  }

  /** Ejecuta un método ORM arbitrario. Requiere sesión iniciada. */
  async executeKw<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.isAuthenticated || this.passwordValue === null) {
      throw new OdooError({ message: 'Sesión no iniciada.', kind: 'auth' });
    }
    return this.rpc<T>('object', 'execute_kw', [
      this.db,
      this.uidValue,
      this.passwordValue,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  async searchRead<T = OdooRecord>(model: string, options: SearchReadOptions = {}): Promise<T[]> {
    const kwargs: Record<string, unknown> = {
      domain: options.domain ?? [],
      fields: options.fields ?? [],
      offset: options.offset ?? 0,
    };
    if (options.limit !== undefined) kwargs.limit = options.limit;
    if (options.order) kwargs.order = options.order;
    return this.executeKw<T[]>(model, 'search_read', [], kwargs);
  }

  async searchCount(model: string, domain: Domain = []): Promise<number> {
    return this.executeKw<number>(model, 'search_count', [domain]);
  }

  async read<T = OdooRecord>(model: string, ids: number[], fields: string[] = []): Promise<T[]> {
    return this.executeKw<T[]>(model, 'read', [ids, fields]);
  }

  async create(model: string, values: Record<string, unknown>): Promise<number> {
    return this.executeKw<number>(model, 'create', [values]);
  }

  async write(model: string, ids: number[], values: Record<string, unknown>): Promise<boolean> {
    return this.executeKw<boolean>(model, 'write', [ids, values]);
  }

  async unlink(model: string, ids: number[]): Promise<boolean> {
    return this.executeKw<boolean>(model, 'unlink', [ids]);
  }

  /** Ejecuta un botón/action del ORM (action_confirm, action_post...). */
  async callButton<T = boolean>(model: string, method: string, ids: number[]): Promise<T> {
    return this.executeKw<T>(model, method, [ids]);
  }

  /* ------------------------------- transporte ------------------------------ */

  private async rpc<T>(service: RpcService, method: string, args: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    this.rpcSeq += 1;
    const id = this.rpcSeq;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id, params: { service, method, args } }),
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new OdooError({
        message: aborted
          ? 'Odoo tardó demasiado en responder (timeout).'
          : 'No se pudo conectar con el servidor Odoo.',
        kind: 'connection',
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new OdooError({
        message: `El servidor Odoo respondió con HTTP ${response.status}.`,
        kind: 'server',
        status: response.status,
      });
    }

    let payload: RpcResponse<T>;
    try {
      payload = (await response.json()) as RpcResponse<T>;
    } catch {
      throw new OdooError({
        message: 'La respuesta de Odoo no es JSON válido (¿proxy mal configurado?).',
        kind: 'server',
        status: response.status,
      });
    }

    if (payload.error) {
      const data = payload.error.data ?? {};
      throw new OdooError({
        message: stripHtml(data.message ?? payload.error.message ?? 'Error de Odoo.'),
        kind: 'rpc',
        code: payload.error.code,
        odooName: data.name,
        debug: data.debug,
      });
    }

    return payload.result as T;
  }
}
