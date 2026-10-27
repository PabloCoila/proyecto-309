import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { AlertCircle } from 'lucide-react';

interface FieldShellProps {
  label?: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, error, hint, htmlFor, children, className }: FieldShellProps) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="label block">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, trailing, className, containerClassName, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={inputId} className={containerClassName}>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={clsx(
            'field',
            icon && 'pl-10',
            trailing && 'pr-11',
            error && 'field-error',
            className,
          )}
          {...props}
        />
        {trailing ? <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </div>
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, containerClassName, id, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={selectId} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={clsx('field appearance-none pr-9', error && 'field-error', className)}
          {...props}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, containerClassName, id, ...props },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;

  return (
    <FieldShell label={label} error={error} hint={hint} htmlFor={areaId} className={containerClassName}>
      <textarea
        ref={ref}
        id={areaId}
        className={clsx('field min-h-[84px] resize-y', error && 'field-error', className)}
        {...props}
      />
    </FieldShell>
  );
});
