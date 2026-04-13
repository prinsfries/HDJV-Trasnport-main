import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../utils/api/index.js'
import { usePageHeader } from '../../components/header/useHeader'
import { useLanguage } from '../../contexts/useLanguage'
import './Notifications.css'

const Notifications = () => {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [displayedNotifications, setDisplayedNotifications] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const ITEMS_PER_PAGE = 25

  usePageHeader(t('pages.notifications'))

  useEffect(() => {
    let active = true
    fetchNotifications(1, ITEMS_PER_PAGE)
      .then((data) => {
        if (!active) return
        const items = Array.isArray(data) ? data : []
        setDisplayedNotifications(items)
        setHasMore(items.length === ITEMS_PER_PAGE)
        setPage(1)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(err?.message || 'Unable to load notifications')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || loadingMoreRef.current || !hasMore) return
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    const nextPage = page + 1
    try {
      const data = await fetchNotifications(nextPage, ITEMS_PER_PAGE)
      const items = Array.isArray(data) ? data : []
      setDisplayedNotifications((prev) => [...prev, ...items])
      setHasMore(items.length === ITEMS_PER_PAGE)
      setPage(nextPage)
    } catch (err) {
      console.error('Failed to load more notifications:', err)
    } finally {
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [isLoading, isLoadingMore, hasMore, page])

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
      await markNotificationRead(notification.id)
      setDisplayedNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      )
    }
    const target = resolveNotificationRoute(notification)
    navigate(target)
  }, [resolveNotificationRoute, navigate])

  const handleScroll = useCallback((event) => {
    const target = event.currentTarget
    const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 80
    if (isNearBottom) {
      loadMore()
    }
  }, [loadMore])

  return (
    <>
      {errorMessage && <div className="table-error">{errorMessage}</div>}
      <div className="table-container">
        <div className="table-actions">
          <button
            className="btn btn-secondary"
            onClick={async () => {
              await markAllNotificationsRead()
              const readAt = new Date().toISOString()
              setDisplayedNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || readAt })))
            }}
          >
            Mark all read
          </button>
        </div>
        <div className="table-wrapper table-wrapper-scroll" onScroll={handleScroll}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="4" className="table-state">Loading notifications...</td>
                </tr>
              )}
              {!isLoading && displayedNotifications.length === 0 && (
                <tr>
                  <td colSpan="4" className="table-state">No notifications found.</td>
                </tr>
              )}
              {!isLoading && displayedNotifications.map((n) => (
                <tr
                  key={n.id}
                  className={!n.read_at ? 'notif-unread' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleNotificationClick(n)}
                >
                  <td>{n.title}</td>
                  <td>{n.body || '--'}</td>
                  <td>{n.read_at ? 'Read' : 'Unread'}</td>
                  <td>{n.created_at ? new Date(n.created_at).toLocaleString() : '--'}</td>
                </tr>
              ))}
              {!isLoading && isLoadingMore && (
                <tr>
                  <td colSpan="4" className="table-state">Loading more...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Notifications



