/**
 * Persistencia de sesión en el navegador.
 * sessionStorage: la contraseña muere al cerrar la pestaña (nunca localStorage).
 */
const KEY = 'p309.odoo.session';

export interface StoredSession {
  db: string;
  login: string;
  password: string;
  uid: number;
  userName?: string;
}

export function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* modo privado / storage lleno: la sesión solo vive en memoria */
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.db || !parsed.login || !parsed.password || typeof parsed.uid !== 'number') return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
