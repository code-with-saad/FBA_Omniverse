import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Loads data from the API and re-loads when `path` changes.
 * const { data, loading, error, reload, setData } = useFetch('/products?page=1');
 * Pass `null` as the path to skip loading. While a new path loads, the previous
 * data stays on screen (no flicker) and `loading` is true.
 */
export default function useFetch(path) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: null });
  const key = path ? `${path}#${tick}` : null;

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    api
      .get(path, { signal: controller.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState((s) => ({ key, data: s.data, error: err }));
      });
    return () => controller.abort();
  }, [path, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);

  return {
    data: state.data,
    loading: Boolean(path) && state.key !== key,
    error: state.key === key ? state.error : null,
    reload,
    setData,
  };
}
