import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import clsx from 'clsx';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLES: Record<ToastKind, { ring: string; icon: ReactNode; bar: string }> = {
  success: {
    ring: 'border-emerald-500/25',
    bar: 'bg-emerald-400',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden />,
  },
  error: {
    ring: 'border-rose-500/30',
    bar: 'bg-rose-400',
    icon: <AlertTriangle className="h-4 w-4 text-rose-300" aria-hidden />,
  },
  info: {
    ring: 'border-gold-500/25',
    bar: 'bg-gold-400',
    icon: <Info className="h-4 w-4 text-gold-300" aria-hidden />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string) => {
      seq.current += 1;
      const id = seq.current;
      setItems((current) => [...current.slice(-3), { id, kind, title, message }]);
      const timer = window.setTimeout(() => dismiss(id), kind === 'error' ? 6500 : 4200);
      timers.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const registered = timers.current;
    return () => registered.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col-reverse gap-2">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const style = STYLES[item.kind];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={clsx(
                  'pointer-events-auto relative overflow-hidden rounded-xl border bg-ink-800/95 p-3.5 shadow-panel backdrop-blur',
                  style.ring,
                )}
              >
                <span className={clsx('absolute inset-y-0 left-0 w-[3px]', style.bar)} />
                <div className="flex items-start gap-2.5 pl-1">
                  <span className="mt-0.5">{style.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    {item.message ? <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.message}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="rounded p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
                    aria-label="Descartar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return context;
}
