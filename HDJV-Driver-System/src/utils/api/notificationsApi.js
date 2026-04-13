import { API_BASE_URL, getAuthHeaders, handleApiError } from './baseApi.js'

export const fetchNotifications = async (page = 1, perPage = 10) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: perPage.toString()
  })

  const response = await fetch(`${API_BASE_URL}/api/notifications?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load notifications')
  }
  const data = await response.json()
  if (Array.isArray(data)) {
    return data
  }
  if (data && Array.isArray(data.data)) {
    return data.data
  }
  return []
}

export const markNotificationRead = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to mark notification as read')
  }
  return response.json()
}

export const markAllNotificationsRead = async () => {
  const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to mark notifications as read')
  }
  return response.json()
}
