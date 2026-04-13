import React, { useCallback, useMemo, useState, useEffect } from 'react'
import LanguageContext from './LanguageContextBase'
import translations from '../i18n/translations'

const DEFAULT_LANGUAGE = 'en'

const getInitialLanguage = () => {
  try {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}')
    const fromUser = localUser?.preferences?.language
    if (fromUser) return fromUser
  } catch {
    // Ignore parsing errors
  }
  const fromStorage = localStorage.getItem('appLanguage')
  return fromStorage || DEFAULT_LANGUAGE
}

const resolveTranslation = (lang, key) => {
  if (!key) return ''
  const segments = key.split('.')
  let node = translations[lang]
  for (const segment of segments) {
    if (!node || typeof node !== 'object') return undefined
    node = node[segment]
  }
  return node
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(getInitialLanguage)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
    localStorage.setItem('appLanguage', language)
    try {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}')
      if (localUser && typeof localUser === 'object' && localUser.id) {
        localStorage.setItem('user', JSON.stringify({
          ...localUser,
          preferences: {
            ...(localUser.preferences || {}),
            language
          }
        }))
      }
    } catch {
      // Ignore localStorage sync errors
    }
  }, [language])

  const t = useCallback((key, fallback = '') => {
    const resolved = resolveTranslation(language, key)
    if (typeof resolved === 'string') return resolved
    const fallbackResolved = resolveTranslation(DEFAULT_LANGUAGE, key)
    if (typeof fallbackResolved === 'string') return fallbackResolved
    return fallback || key
  }, [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
