import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin text-gold-400', className)} aria-hidden />;
}

export function Stat({
  label,
  value,
  icon,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        'surface relative overflow-hidden p-4',
        accent && 'border-gold-500/20 bg-gradient-to-br from-gold-500/[0.07] to-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">{label}</p>
          <p className={clsx('mt-2 text-2xl font-semibold tracking-tight', accent ? 'text-gold-300' : 'text-white')}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-gold-300">{icon}</span>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-gold-400">{icon}</div>
      ) : null}
      <p className="text-sm font-medium text-white">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-white/[0.05]">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div
              key={colIndex}
              className="h-3 animate-pulse rounded-full bg-white/[0.06]"
              style={{ width: `${colIndex === 0 ? 34 : 12 + ((rowIndex + colIndex) % 3) * 5}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
