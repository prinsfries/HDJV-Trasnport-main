import React, { useState, useEffect } from 'react'
import { updateUser } from '../../utils/api/index.js'
import firebaseService from '../../services/FirebaseService'
import { useToast } from '../../components/Toast/ToastContext'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import { useDateTimeFormat } from '../../contexts/useDateTimeFormat'
import './Settings.css'

const Settings = () => {
  const toast = useToast()
  const { t, language, setLanguage } = useLanguage()
  const { applyFormats } = useDateTimeFormat()
  const [settings, setSettings] = useState({
    dateFormat: '1',
    timeFormat: '12',
    language: 'en',
    notificationsEnabled: false
  })
  const [saving, setSaving] = useState(false)
  usePageHeader(t('pages.settings'))

  useEffect(() => {
    loadUserPreferences()
  }, [])

  const loadUserPreferences = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const preferences = user.preferences || {}
      const preferredLanguage = preferences.language || 'en'
      
      setSettings({
        dateFormat: preferences.dateFormat || '1',
        timeFormat: preferences.timeFormat || '12',
        language: preferredLanguage,
        notificationsEnabled: Boolean(preferences.notificationsEnabled)
      })
      if (preferredLanguage && preferredLanguage !== language) {
        setLanguage(preferredLanguage)
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }

  const dateFormatOptions = [
    { value: '1', label: 'MM/DD/YY', example: '02/17/2009', description: t('settings.dateFormatDescriptions.1') },
    { value: '2', label: 'DD/MM/YY', example: '17/02/2009', description: t('settings.dateFormatDescriptions.2') },
    { value: '3', label: 'YY/MM/DD', example: '2009/02/17', description: t('settings.dateFormatDescriptions.3') },
    { value: '4', label: 'Month D, Yr', example: 'February 17, 2009', description: t('settings.dateFormatDescriptions.4') },
    { value: '5', label: 'M/D/YY', example: '2/17/2009', description: t('settings.dateFormatDescriptions.5') },
    { value: '6', label: 'D/M/YY', example: '17/2/2009', description: t('settings.dateFormatDescriptions.6') },
    { value: '7', label: 'YY/M/D', example: '2009/2/17', description: t('settings.dateFormatDescriptions.7') },
    { value: '8', label: 'D Month, Yr', example: '17 February, 2009', description: t('settings.dateFormatDescriptions.8') },
    { value: '9', label: 'Yr, Month D', example: '2009, February 17', description: t('settings.dateFormatDescriptions.9') },
    { value: '10', label: 'Mon-DD-YYYY', example: 'Feb 17, 2009', description: t('settings.dateFormatDescriptions.10') },
    { value: '11', label: 'DD-Mon-YYYY', example: '17 Feb, 2009', description: t('settings.dateFormatDescriptions.11') },
    { value: '12', label: 'YYYY-Mon-DD', example: '2009, Feb 17', description: t('settings.dateFormatDescriptions.12') },
    { value: '13', label: 'Mon DD, YYYY', example: 'Feb 17, 2014', description: t('settings.dateFormatDescriptions.13') },
    { value: '14', label: 'DD Mon, YYYY', example: '17 Feb, 2014', description: t('settings.dateFormatDescriptions.14') },
    { value: '15', label: 'YYYY, Mon DD', example: '2014, Feb 17', description: t('settings.dateFormatDescriptions.15') }
  ]

  const timeFormatOptions = [
    { value: '12', label: t('settings.timeFormatLabels.12'), example: '2:30 PM', description: t('settings.timeFormatDescriptions.12') },
    { value: '24', label: t('settings.timeFormatLabels.24'), example: '14:30', description: t('settings.timeFormatDescriptions.24') }
  ]

  const languageOptions = [
    { value: 'en', label: t('settings.language.english') },
    { value: 'ko', label: t('settings.language.korean') }
  ]

  
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const persistNotificationPreference = async (enabled) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user?.id) {
      toast.showError(t('settings.missingUserInfo'))
      return
    }

    const updatedPreferences = {
      ...(user.preferences || {}),
      notificationsEnabled: enabled,
      notificationsPromptDismissed: true
    }

    try {
      await updateUser(user.id, { preferences: updatedPreferences })
      localStorage.setItem('user', JSON.stringify({
        ...user,
        preferences: updatedPreferences
      }))
    } catch (error) {
      console.error('Failed to save notification preference:', error)
      toast.showError(t('settings.notificationsSaveFailed'))
    }
  }

  const handleNotificationToggle = async (event) => {
    const enabled = event.target.checked
    if (enabled) {
      const token = await firebaseService.requestPermissionAndGetToken()
      if (!token) {
        toast.showInfo(t('settings.notificationsNotEnabled'))
        setSettings(prev => ({ ...prev, notificationsEnabled: false }))
        await persistNotificationPreference(false)
        return
      }
      setSettings(prev => ({ ...prev, notificationsEnabled: true }))
      await persistNotificationPreference(true)
      toast.showSuccess(t('settings.notificationsEnabled'))
      return
    }

    await firebaseService.disableNotifications()
    setSettings(prev => ({ ...prev, notificationsEnabled: false }))
    await persistNotificationPreference(false)
    toast.showInfo(t('settings.notificationsDisabled'))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      // Get current user from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      if (!user?.id) {
        toast.showError(t('settings.missingUserInfo'))
        return
      }
      
      // Update preferences
      const updatedPreferences = {
        ...(user.preferences || {}),
        dateFormat: settings.dateFormat,
        timeFormat: settings.timeFormat,
        language: settings.language,
        notificationsEnabled: settings.notificationsEnabled
      }
      
      // Update user in backend
      await updateUser(user.id, {
        preferences: updatedPreferences
      })
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify({
        ...user,
        preferences: updatedPreferences
      }))
      
      // Apply date and time format settings
      applyFormats(settings.dateFormat, settings.timeFormat)

      // Apply language setting
      setLanguage(settings.language)
      
      toast.showSuccess(t('settings.settingsSaved'))
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.showError(t('settings.settingsSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const getDateFormatPreview = () => {
    const date = new Date('2009-02-17')
    return formatCustomDate(date, settings.dateFormat)
  }

  const getTimeFormatPreview = () => {
    const date = new Date()
    date.setHours(14, 30, 0) // Set to 2:30 PM for consistent preview
    return formatCustomTime(date, settings.timeFormat)
  }

  const formatCustomDate = (date, format) => {
    const day = date.getDate()
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    const monthNames = language === 'ko'
      ? ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
      : ['January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December']
    const monthAbbrev = language === 'ko'
      ? monthNames
      : monthNames.map(m => m.substring(0, 3))

    switch(format) {
      case '1': // MM/DD/YY
        return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
      case '2': // DD/MM/YY
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
      case '3': // YY/MM/DD
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
      case '4': // Month D, Yr
        return `${monthNames[month-1]} ${day}, ${year}`
      case '5': // M/D/YY
        return `${month}/${day}/${year}`
      case '6': // D/M/YY
        return `${day}/${month}/${year}`
      case '7': // YY/M/D
        return `${year}/${month}/${day}`
      case '8': // D Month, Yr
        return `${day} ${monthNames[month-1]}, ${year}`
      case '9': // Yr, Month D
        return `${year}, ${monthNames[month-1]} ${day}`
      case '10': // Mon-DD-YYYY
        return `${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}, ${year}`
      case '11': // DD-Mon-YYYY
        return `${String(day).padStart(2, '0')} ${monthAbbrev[month-1]}, ${year}`
      case '12': // YYYY-Mon-DD
        return `${year}, ${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}`
      case '13': // Mon DD, YYYY
        return `${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}, ${year}`
      case '14': // DD Mon, YYYY
        return `${String(day).padStart(2, '0')} ${monthAbbrev[month-1]}, ${year}`
      case '15': // YYYY, Mon DD
        return `${year}, ${monthAbbrev[month-1]} ${String(day).padStart(2, '0')}`
      default:
        return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`
    }
  }

  const formatCustomTime = (date, format) => {
  let hours = date.getHours()
  let minutes = date.getMinutes()
  let ampm = ''

  if (format === '12') {
    if (language === 'ko') {
      ampm = hours >= 12 ? ' 오후' : ' 오전'
    } else {
      ampm = hours >= 12 ? ' PM' : ' AM'
    }
    hours = hours % 12
    hours = hours ? hours : 12 // 0 should be 12
  }

  const pad = (num) => String(num).padStart(2, '0')

  switch(format) {
    case '12':
      return `${hours}:${pad(minutes)}${ampm}`
    case '24':
      return `${pad(hours)}:${pad(minutes)}`
    default:
      return `${hours}:${pad(minutes)}${ampm}`
  }
}

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-section">
          <h2>{t('settings.dateTime')}</h2>
          <div className="setting-group">
            <label htmlFor="date-format">{t('settings.dateFormat')}</label>
            <select
              id="date-format"
              value={settings.dateFormat}
              onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
            >
              {dateFormatOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.example}
                </option>
              ))}
            </select>
            <small className="setting-description">
              {dateFormatOptions.find(opt => opt.value === settings.dateFormat)?.description}
            </small>
          </div>

          <div className="setting-group">
            <label htmlFor="time-format">{t('settings.timeFormat')}</label>
            <select
              id="time-format"
              value={settings.timeFormat}
              onChange={(e) => handleSettingChange('timeFormat', e.target.value)}
            >
              {timeFormatOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.example}
                </option>
              ))}
            </select>
            <small className="setting-description">
              {timeFormatOptions.find(opt => opt.value === settings.timeFormat)?.description}
            </small>
          </div>

          <div className="setting-preview">
            <label>{t('settings.preview')}</label>
            <div className="preview-box">
              {getDateFormatPreview()} {t('settings.previewAt')} {getTimeFormatPreview()}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>{t('settings.language.title')}</h2>
          <div className="setting-group">
            <label htmlFor="language-select">{t('settings.language.label')}</label>
            <select
              id="language-select"
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small className="setting-description">
              {t('settings.language.description')}
            </small>
          </div>
        </div>

        <div className="settings-section">
          <h2>{t('settings.notifications')}</h2>
          <div className="setting-group">
            <label className="checkbox-label" htmlFor="notifications-enabled">
              <input
                id="notifications-enabled"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={handleNotificationToggle}
              />
              <span>{t('settings.enableNotifications')}</span>
            </label>
            <small className="setting-description">
              {t('settings.notificationsDescription')}
            </small>
          </div>
        </div>

        
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('settings.saving') : t('settings.saveSettings')}
          </button>
          <button className="btn btn-secondary" onClick={() => {
            // Reset to defaults
            setSettings({
              dateFormat: '1',
              timeFormat: '12',
              language: 'en',
              notificationsEnabled: false
            })
          }} disabled={saving}>
            {t('settings.resetDefaults')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings



