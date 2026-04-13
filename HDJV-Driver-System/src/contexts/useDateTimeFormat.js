import { useContext } from 'react'
import DateTimeFormatContext from './DateTimeFormatContextBase'

export const useDateTimeFormat = () => {
  const ctx = useContext(DateTimeFormatContext)
  if (!ctx) {
    throw new Error('useDateTimeFormat must be used within DateTimeFormatProvider')
  }
  return ctx
}
