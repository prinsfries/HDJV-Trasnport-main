import React, { useCallback, useEffect, useMemo, useState } from 'react'
import DateTimeFormatContext from './DateTimeFormatContextBase'
import { setDateFormat, setTimeFormat } from '../utils/dateUtils'

const readPreferences = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const preferences = user.preferences || {}
    return {
      dateFormat: preferences.dateFormat || '1',
      timeFormat: preferences.timeFormat || '12'
    }
  } catch {
    return { dateFormat: '1', timeFormat: '12' }
  }
}

export const DateTimeFormatProvider = ({ children }) => {
  const initial = readPreferences()
  const [dateFormat, setDateFormatState] = useState(initial.dateFormat)
  const [timeFormat, setTimeFormatState] = useState(initial.timeFormat)

  useEffect(() => {
    setDateFormat(dateFormat)
    setTimeFormat(timeFormat)
  }, [dateFormat, timeFormat])

  const applyFormats = useCallback((nextDateFormat, nextTimeFormat) => {
    setDateFormatState(nextDateFormat)
    setTimeFormatState(nextTimeFormat)
  }, [])

  const reloadFromPreferences = useCallback(() => {
    const next = readPreferences()
    setDateFormatState(next.dateFormat)
    setTimeFormatState(next.timeFormat)
  }, [])

  const value = useMemo(() => ({
    dateFormat,
    timeFormat,
    applyFormats,
    reloadFromPreferences
  }), [dateFormat, timeFormat, applyFormats, reloadFromPreferences])

  return (
    <DateTimeFormatContext.Provider value={value}>
      {children}
    </DateTimeFormatContext.Provider>
  )
}
