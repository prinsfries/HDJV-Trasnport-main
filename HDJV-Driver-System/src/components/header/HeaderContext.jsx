import React, { useCallback, useMemo, useState } from 'react'
import HeaderContext from './HeaderContextBase'

export const HeaderProvider = ({ children }) => {
  const [header, setHeader] = useState({ title: '', subtitle: '' })

  const setPageHeader = useCallback((title, subtitle = '') => {
    setHeader({ title: title || '', subtitle: subtitle || '' })
  }, [])

  const value = useMemo(() => ({ header, setPageHeader }), [header, setPageHeader])

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>
}
