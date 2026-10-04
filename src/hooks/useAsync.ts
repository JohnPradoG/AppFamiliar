import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// Carga datos al montar y cada vez que cambian las dependencias; expone recargar() para "tirar para refrescar".
// Además se vuelve a cargar solo (sin parpadeo) al volver a la pantalla y al reabrir la app, para que un saldo o una
// transferencia hechos desde otro teléfono aparezcan sin tener que cerrar la app.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loadedOnce = useRef(false);
  const run = useCallback(async (silent = false) => {
    const mine = ++seq.current; // ignora respuestas viejas si el usuario cambia de filtro rápido
    if (!silent) setLoading(true);
    try {
      const r = await fn();
      if (mine === seq.current) { setData(r); setError(null); loadedOnce.current = true; }
    } catch (e) {
      if (mine === seq.current && !silent) setError(e);   // un fallo de la recarga silenciosa no borra lo que ya se ve
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { void run(); }, [run]);
  // Al volver a esta pantalla (pestañas, volver atrás) recarga en silencio.
  useFocusEffect(useCallback(() => { if (loadedOnce.current) void run(true); }, [run]));
  // Al reabrir la app desde segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && loadedOnce.current) void run(true); });
    return () => sub.remove();
  }, [run]);
  return { data, error, loading, reload: () => run() };
}
