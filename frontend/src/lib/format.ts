/** Utilidades de formato comunes a toda la UI y al PDF. */

const LOCALE = 'es-BO';

/** Valida que el símbolo recibido de Odoo sea un código ISO 4217 usable. */
export function safeCurrency(code?: string | false | null): string {
  const value = typeof code === 'string' ? code.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(value) ? value : 'USD';
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatQty(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

export function formatMoney(value: number, currency = 'USD'): string {
  const code = safeCurrency(currency);
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${code} ${formatNumber(value)}`;
  }
}

export function formatDate(value?: string | false | null): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value: Date = new Date()): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function todayLong(): string {
  const formatted = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function displayCode(value?: string | false | null): string {
  return value ? String(value) : '—';
}

/** "WH/Stock" -> "Stock" para listas compactas. */
export function shortLocation(completeName?: string): string {
  if (!completeName) return '—';
  const parts = completeName.split('/');
  return parts[parts.length - 1];
}
