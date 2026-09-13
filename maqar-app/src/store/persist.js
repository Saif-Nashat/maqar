import { useState, useEffect } from "react";

/**
 * useState that mirrors to localStorage under `key`.
 * `initial` may be a value or a factory; used only when nothing is stored yet.
 */
export function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch { /* ignore */ }
    return typeof initial === "function" ? initial() : initial;
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);

  return [value, setValue];
}
