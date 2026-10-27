import type { ReactNode } from 'react';
import clsx from 'clsx';

type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/[0.05] text-slate-300',
  gold: 'border-gold-500/30 bg-gold-500/10 text-gold-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('surface', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
