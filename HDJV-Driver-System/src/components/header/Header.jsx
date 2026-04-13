import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { useHeader } from './useHeader'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../utils/api/index.js'
import firebaseService from '../../services/FirebaseService'
import { useLanguage } from '../../contexts/useLanguage'
import './Header.css'

const ITEMS_PER_PAGE = 10
const MAX_HEIGHT = 400 // pixels

const Header = () => {
  const navigate = useNavigate()
  const { header } = useHeader()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const dropdownRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = useCallback(async (pageNum = 1, reset = false) => {
    if (loadingRef.current) return

    loadingRef.current = true
    setLoading(true)
    try {
      const data = await fetchNotifications(pageNum, ITEMS_PER_PAGE)
      const newNotifications = Array.isArray(data) ? data : []
      
      if (reset) {
        setNotifications(newNotifications)
      } else {
        setNotifications(prev => [...prev, ...newNotifications])
      }
      
      // Check if there are more notifications
      setHasMore(newNotifications.length === ITEMS_PER_PAGE)
    } catch (error) {
      console.error('Failed to load notifications:', error)
      if (reset) {
        setNotifications([])
      }
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  // Reset pagination when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setPage(1)
      setHasMore(true)
      loadNotifications(1, true)
    }
  }, [isOpen, loadNotifications])

  // Initial load to show unread dot without opening dropdown
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    loadNotifications(1, true)
  }, [loadNotifications])

  // Realtime updates via FCM foreground messages
  useEffect(() => {
    const unsubscribe = firebaseService.onMessage(() => {
      setPage(1)
      setHasMore(true)
      loadNotifications(1, true)
    })
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [loadNotifications])

  // Polling fallback when notifications are blocked or backgrounded
  useEffect(() => {
    let intervalId = null

    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return
      setPage(1)
      setHasMore(true)
      loadNotifications(1, true)
    }

    if (typeof Notification === 'undefined') {
      return () => {}
    }

    intervalId = setInterval(refresh, 60000)

    const handleVisibility = () => {
      refresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadNotifications])

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50
    
    if (isNearBottom && hasMore && !loading) {
      const nextPage = page + 1
      setPage(nextPage)
      loadNotifications(nextPage, false)
    }
  }, [hasMore, loading, page, loadNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  )

  const handleMarkAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationRead(notificationId)
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }, [])

  const parseNotificationData = useCallback((notification) => {
    const raw = notification?.data
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }, [])

  const resolveNotificationRoute = useCallback((notification) => {
    const data = parseNotificationData(notification)
    if (data.request_id || ['request_created', 'request_accepted', 'request_rejected', 'request_assigned', 'request_assigned_driver'].includes(notification?.type)) {
      return '/requests'
    }
    if (data.trip_id || data.tripId) {
      return '/routes'
    }
    return '/notifications'
  }, [parseNotificationData])

  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification) return
    if (!notification.read_at) {
      await handleMarkAsRead(notification.id)
    }
    const target = resolveNotificationRoute(notification)
    setIsOpen(false)
    navigate(target)
  }, [handleMarkAsRead, resolveNotificationRoute, navigate])

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      )
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  }, [])

  return (
    <div className="app-header">
      <div className="app-header-left">
        <h2>{header.title || t('header.defaultTitle')}</h2>
      </div>
      <div className="app-header-right" ref={dropdownRef}>
        <button
          type="button"
          className="notify-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          title={t('header.notifications')}
        >
          <i className="bi bi-bell"></i>
          {unreadCount > 0 && <span className="notify-dot"></span>}
        </button>
        {isOpen && (
          <div className="notify-dropdown">
            <div className="notify-header">
              <span>{t('header.notifications')}</span>
              <button
                type="button"
                className="notify-clear"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                {t('header.markAllRead')}
              </button>
            </div>
            
            {/* Scrollable notification list */}
            <div 
              className="notify-scroll-container"
              ref={scrollContainerRef}
              onScroll={handleScroll}
              style={{ maxHeight: `${MAX_HEIGHT}px` }}
            >
              {notifications.length === 0 && !loading && (
                <div className="notify-empty">{t('header.noNotifications')}</div>
              )}
              
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notify-item ${n.read_at ? '' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                  disabled={loading}
                >
                  <span className="notify-title">{n.title}</span>
                  <span className="notify-time">{n.body || ''}</span>
                </button>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="notify-loading">
                  <div className="notify-spinner"></div>
                  <span>{t('header.loading')}</span>
                </div>
              )}
              
              {/* End of notifications indicator */}
              {!hasMore && notifications.length > 0 && (
                <div className="notify-end">
                  <span>{t('header.noMoreNotifications')}</span>
                </div>
              )}
            </div>
            
            <div className="notify-footer">
              <Link to="/notifications">{t('header.viewAll')}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Header



