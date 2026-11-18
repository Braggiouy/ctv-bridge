import { useCallback, useState } from "react";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** useState backed by localStorage, re-read whenever the key changes. */
export function usePersistentState<T>(key: string, fallback: T) {
  const [state, setState] = useState(() => ({
    key,
    value: read(key, fallback),
  }));
  const value = state.key === key ? state.value : read(key, fallback);

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      setState((current) => {
        const previous =
          current.key === key ? current.value : read(key, fallback);
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        localStorage.setItem(key, JSON.stringify(resolved));
        return { key, value: resolved };
      });
    },
    // fallback is a default for first read only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return [value, setValue] as const;
}
