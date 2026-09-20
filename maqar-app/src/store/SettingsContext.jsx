import { createContext, useContext, useState, useEffect, useCallback } from "react";

const SettingsContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);

function readStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => readStored("maqar-theme", "light"));
  const [lang, setLang] = useState(() => readStored("maqar-lang", "en"));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("maqar-theme", theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    try { localStorage.setItem("maqar-lang", lang); } catch { /* ignore */ }
  }, [lang]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  const toggleLang = useCallback(() => setLang((l) => (l === "ar" ? "en" : "ar")), []);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, toggleTheme, lang, setLang, toggleLang }}>
      {children}
    </SettingsContext.Provider>
  );
}
