import { useContext, useEffect } from 'react'
import HeaderContext from './HeaderContextBase'

export const useHeader = () => {
  const ctx = useContext(HeaderContext)
  if (!ctx) {
    throw new Error('useHeader must be used within HeaderProvider')
  }
  return ctx
}

export const usePageHeader = (title, subtitle = '') => {
  const { setPageHeader } = useHeader()
  useEffect(() => {
    setPageHeader(title, subtitle)
  }, [setPageHeader, title, subtitle])
}
