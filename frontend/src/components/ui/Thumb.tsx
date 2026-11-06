import type { ReactNode } from 'react';
import clsx from 'clsx';

/** Miniatura base64 de Odoo; cae al fallback cuando el registro no tiene imagen. */
export function Thumb({
  base64,
  className,
  rounded = 'rounded-lg',
  fallback,
}: {
  base64?: string | false;
  className?: string;
  rounded?: string;
  fallback: ReactNode;
}) {
  if (base64) {
    return (
      <img
        src={`data:image/png;base64,${base64}`}
        alt=""
        loading="lazy"
        className={clsx('shrink-0 border border-slate-200 bg-white object-cover', rounded, className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-gold-300',
        rounded,
        className,
      )}
    >
      {fallback}
    </span>
  );
}
