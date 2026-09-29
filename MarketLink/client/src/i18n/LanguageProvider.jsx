import { createContext, Fragment, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LANGS, applyDocumentLang, getLang, setForcedEnglish, setStoredLang, t } from './index';

const LanguageContext = createContext({ lang: 'en', setLang: () => {} });

/**
 * Holds the chosen language. The admin area always stays in English. When the language changes the
 * app below is re-mounted (a `key`), so every text, date and price is drawn again in that language.
 */
export function LanguageProvider({ children }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(getLang);
  setForcedEnglish(pathname.startsWith('/admin'));
  const lang = getLang();

  useLayoutEffect(() => {
    applyDocumentLang();
  }, [lang]);

  const setLang = useCallback(
    (next) => {
      if (!LANGS[next]) return;
      setStoredLang(next);
      setChosen(next);
      // A ?lang= in the address would switch it back on reload, so keep it in step
      const params = new URLSearchParams(search);
      if (params.has('lang')) {
        params.set('lang', next);
        navigate({ pathname, search: `?${params}` }, { replace: true });
      }
    },
    [navigate, pathname, search]
  );

  const value = useMemo(() => ({ lang, chosen, setLang }), [lang, chosen, setLang]);
  return (
    <LanguageContext.Provider value={value}>
      <Fragment key={lang}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);

/** "اردو" / "English" switch for the navbar, the phone menu and the footer. */
export function LanguageSwitch({ className = '', compact = false }) {
  const { lang, setLang } = useLanguage();
  const next = lang === 'ur' ? 'en' : 'ur';
  return (
    <button
      type="button"
      className={`lang-switch ${className}`}
      onClick={() => setLang(next)}
      lang={LANGS[next].htmlLang}
      aria-label={next === 'ur' ? 'اردو میں دیکھیں (Urdu)' : 'View in English'}
      title={next === 'ur' ? 'اردو' : 'English'}
    >
      <i className="bi bi-translate" aria-hidden="true" />
      {!compact && <span>{next === 'ur' ? 'اردو' : 'English'}</span>}
      <span className="visually-hidden">{t('Language')}</span>
    </button>
  );
}
