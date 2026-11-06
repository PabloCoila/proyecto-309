import { useEffect, useRef, useState } from 'react';

/** Devuelve el valor retrasado `delay` ms (para búsquedas contra Odoo). */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Hook para búsquedas con cancelación de peticiones previas.
 * Evita condiciones de carrera cuando el usuario escribe rápido.
 */
export function useSearch<T>(
  searchFn: (signal: AbortSignal, query: string) => Promise<T>,
  query: string,
  delay = 300,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      if (!query.trim()) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      searchFn(controller.signal, query)
        .then((result) => {
          if (!controller.signal.aborted) {
            setData(result);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted && err.name !== 'AbortError') {
            setError(err);
            setLoading(false);
          }
        });
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, delay, searchFn]);

  return { data, loading, error };
}
