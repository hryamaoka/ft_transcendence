import { createContext, useContext, useEffect, useState } from 'react';
import en from './locales/en.js';
import ja from './locales/ja.js';
import fr from './locales/fr.js';

export const LANGUAGES = { en: 'English', ja: '日本語', fr: 'Français' };
const DICTS = { en, ja, fr };

// localStorage may be unavailable (private mode etc.), so every access is guarded.
function savedLang() {
  try {
    const l = localStorage.getItem('lang');
    if (DICTS[l]) return l;
  } catch { /* ignore */ }
  const nav = navigator.language?.slice(0, 2);
  return DICTS[nav] ? nav : 'en';
}

const I18n = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(savedLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICTS[lang].app.name;
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  }, [lang]);

  // t('room.title', { code }) looks up a key and fills {placeholders}; falls back to English.
  const t = (key, vars = {}) => {
    const lookup = (dict) => key.split('.').reduce((o, k) => o?.[k], dict);
    const s = lookup(DICTS[lang]) ?? lookup(en) ?? key;
    return String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  const tError = (code) => (t(`errors.${code}`) === `errors.${code}` ? t('errors.generic') : t(`errors.${code}`));

  return <I18n.Provider value={{ lang, setLang, t, tError }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
