import { useId } from 'react';
import clsx from 'clsx';

/** Monograma 309: tile dorado, base de toda la identidad visual. */
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
      aria-label="Proyecto 309"
    >
      <defs>
        <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F7EDD3" />
          <stop offset="42%" stopColor="#D8B45F" />
          <stop offset="100%" stopColor="#B8933F" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#gold-${id})`} />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15.2"
        fill="none"
        stroke="rgba(255,255,255,0.38)"
        strokeWidth="1.1"
      />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        letterSpacing="-0.6"
        fill="#0C1118"
      >
        309
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
        <p className="truncate text-[13.5px] font-semibold tracking-[0.14em] text-white">
          PROYECTO <span className="text-gold-400">309</span>
        </p>
        {subtitle ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
