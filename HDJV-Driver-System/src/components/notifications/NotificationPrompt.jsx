import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUser } from '../../contexts/useUser'
import { updateUser } from '../../utils/api/index.js'
import firebaseService from '../../services/FirebaseService'
import { useToast } from '../Toast/ToastContext'
import { useLanguage } from '../../contexts/useLanguage'
import './NotificationPrompt.css'

const NotificationPrompt = () => {
  const { user, loading } = useUser()
  const { showSuccess, showError, showInfo } = useToast()
  const { t } = useLanguage()
  const [isVisible, setIsVisible] = useState(false)
  const [isWorking, setIsWorking] = useState(false)

  const preferences = useMemo(() => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}')
    return {
      ...(localUser.preferences || {}),
      ...(user?.preferences || {})
    }
  }, [user])

  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'

  const shouldPrompt = useMemo(() => {
    if (loading || !user?.id) return false
    if (!('Notification' in window)) return false
    if (permission !== 'default') return false
    if (preferences.notificationsEnabled === true) return false
    if (preferences.notificationsPromptDismissed === true) return false
    return true
  }, [loading, permission, preferences, user?.id])

  const shouldShowBlockedGuidance = useMemo(() => {
    if (loading || !user?.id) return false
    if (!('Notification' in window)) return false
    if (permission !== 'denied') return false
    return preferences.notificationsEnabled === true
  }, [loading, permission, preferences.notificationsEnabled, user?.id])

  useEffect(() => {
    if (!loading && user?.id && preferences.notificationsEnabled === true) {
      firebaseService.getTokenIfPermitted()
    }
  }, [loading, preferences.notificationsEnabled, user?.id])

  useEffect(() => {
    setIsVisible(shouldPrompt || shouldShowBlockedGuidance)
  }, [shouldPrompt, shouldShowBlockedGuidance])

  const persistPreferences = useCallback(async (patch) => {
    if (!user?.id) return
    const nextPreferences = {
      ...(user.preferences || {}),
      ...patch
    }

    try {
      await updateUser(user.id, { preferences: nextPreferences })
    } catch (error) {
      console.warn('Failed to save notification preference:', error)
    } finally {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}')
      localStorage.setItem('user', JSON.stringify({
        ...localUser,
        preferences: {
          ...(localUser.preferences || {}),
          ...patch
        }
      }))
    }
  }, [user])

  const handleEnable = async () => {
    if (isWorking) return
    setIsWorking(true)
    try {
      const token = await firebaseService.requestPermissionAndGetToken()
      if (token) {
        await persistPreferences({
          notificationsEnabled: true,
          notificationsPromptDismissed: true
        })
        showSuccess(t('settings.notificationsEnabled'))
        setIsVisible(false)
      } else {
        await persistPreferences({
          notificationsEnabled: false,
          notificationsPromptDismissed: true
        })
        showInfo(t('settings.notificationsNotEnabled'))
        setIsVisible(false)
      }
    } catch {
      showError(t('settings.notificationsEnableFailed'))
    } finally {
      setIsWorking(false)
    }
  }

  const handleDismiss = async () => {
    await persistPreferences({
      notificationsEnabled: false,
      notificationsPromptDismissed: true
    })
    setIsVisible(false)
  }

  if (!isVisible) return null

  if (shouldShowBlockedGuidance) {
    return (
      <div className="notification-prompt" role="region" aria-label={t('notificationPrompt.helpAria')}>
        <div className="notification-prompt__content">
          <div>
            <h3>{t('notificationPrompt.blockedTitle')}</h3>
            <p>
              {t('notificationPrompt.blockedBody')}
            </p>
          </div>
          <div className="notification-prompt__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDismiss}
              disabled={isWorking}
            >
              {t('notificationPrompt.dismiss')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="notification-prompt" role="region" aria-label={t('notificationPrompt.preferenceAria')}>
      <div className="notification-prompt__content">
        <div>
          <h3>{t('notificationPrompt.enableTitle')}</h3>
          <p>{t('notificationPrompt.enableBody')}</p>
        </div>
        <div className="notification-prompt__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDismiss}
            disabled={isWorking}
          >
            {t('notificationPrompt.notNow')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleEnable}
            disabled={isWorking}
          >
            {isWorking ? t('notificationPrompt.enabling') : t('notificationPrompt.enable')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationPrompt



