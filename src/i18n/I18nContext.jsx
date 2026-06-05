import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { translations } from './translations'

const I18nContext = createContext(null)
const LANG_KEY = 'dentacare.lang'

function resolve(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj)
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY) || 'ar')

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    localStorage.setItem(LANG_KEY, lang)
  }, [lang, dir])

  const setLang = useCallback((l) => setLangState(l), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'ar' ? 'en' : 'ar')), [])

  const t = useCallback(
    (key) => {
      const val = resolve(translations[lang], key)
      if (val != null) return val
      const fallback = resolve(translations.en, key)
      return fallback != null ? fallback : key
    },
    [lang]
  )

  // Pick the right string from an object shaped like { en, ar }
  const L = useCallback((obj) => (obj ? obj[lang] ?? obj.en ?? '' : ''), [lang])

  const value = useMemo(() => ({ lang, dir, setLang, toggleLang, t, L, isRTL: dir === 'rtl' }), [lang, dir, setLang, toggleLang, t, L])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
