import { useId } from 'react';
import clsx from 'clsx';

/** Monograma Neru: tile teal/petróleo, base de toda la identidad visual. */
export function BrandMark({ size = 44, className }: { size?: number; className?: string }) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9-]/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={clsx('shrink-0', className)}
      role="img"
      aria-label="Neru"
    >
      <defs>
        <linearGradient id={`neru-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="55%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#0B1F33" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#neru-${id})`} />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15.2"
        fill="none"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.1"
      />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
        fontSize="32"
        fontWeight="800"
        letterSpacing="-1.2"
        fill="#FFFFFF"
      >
        N
      </text>
    </svg>
  );
}

export function BrandLockup({
  subtitle = 'Inventario & POS',
  markSize = 38,
  className,
}: {
  subtitle?: string | null;
  markSize?: number;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <BrandMark size={markSize} />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13.5px] font-semibold tracking-[0.22em] text-petrol-900">
          NERU
        </p>
        {subtitle ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
