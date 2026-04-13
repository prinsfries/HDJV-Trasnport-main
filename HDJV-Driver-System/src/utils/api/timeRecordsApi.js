import { API_BASE_URL, getAuthHeaders, handleApiError } from './baseApi.js'

export const fetchTimeRecords = async ({ driverId, dateFrom, dateTo } = {}) => {
  if (!driverId) {
    throw new Error('Driver is required')
  }
  const params = new URLSearchParams({
    driver_id: driverId.toString()
  })
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)

  const response = await fetch(`${API_BASE_URL}/api/time-records?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load time records')
  }
  return response.json()
}

export const upsertTimeRecord = async (payload) => {
  const response = await fetch(`${API_BASE_URL}/api/time-records`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to save time record')
  }
  return response.json()
}

export const deleteTimeRecord = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/time-records/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to delete time record')
  }
  return response
}

export const fetchTimeRecordsPerDay = async (date, options = {}) => {
  const { page, pageSize, search } = options
  const params = new URLSearchParams()
  if (date) {
    params.set('date', date)
  }
  if (page) {
    params.set('page', String(page))
  }
  if (pageSize) {
    params.set('page_size', String(pageSize))
  }
  if (search) {
    params.set('search', search)
  }
  const suffix = params.toString() ? `?${params}` : ''
  const response = await fetch(`${API_BASE_URL}/api/time-records/today${suffix}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load today time records')
  }
  return response.json()
}
