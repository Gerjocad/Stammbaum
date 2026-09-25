import { useEffect, useState } from 'react';
import { useLang, type Lang } from '../i18n';

type Theme = 'light' | 'dark';
const THEME_KEY = 'stammbaum-theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignorieren
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Sprachauswahl und Hell/Dunkel-Schalter. */
export function Settings() {
  const { lang, setLang, t } = useLang();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignorieren
    }
  };

  return (
    <div className="settings">
      <select aria-label={t.language} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        <option value="de">Deutsch</option>
        <option value="tr">Türkçe</option>
      </select>
      <button
        className="secondary icon"
        onClick={toggle}
        aria-label={theme === 'dark' ? t.lightMode : t.darkMode}
        title={theme === 'dark' ? t.lightMode : t.darkMode}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  );
}
