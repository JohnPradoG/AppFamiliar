import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos al montar y cada vez que cambian las dependencias; expone recargar() para "tirar para refrescar".
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const mine = ++seq.current; // ignora respuestas viejas si el usuario cambia de filtro rápido
    setLoading(true);
    try {
      const r = await fn();
      if (mine === seq.current) { setData(r); setError(null); }
    } catch (e) {
      if (mine === seq.current) setError(e);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  return { data, error, loading, reload: run };
}
