import { API_BASE_URL, fetchAllPagesWithParams, getAuthHeaders, handleApiError, normalizePagedResponse } from './baseApi.js'

export const fetchTrips = async (page = 1, limit = 50, search = '', sort = {}, filters = {}) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  })
  const trimmedSearch = search.trim()
  if (trimmedSearch.length > 0) {
    params.set('search', trimmedSearch)
  }
  if (sort?.key) {
    params.set('sort_by', sort.key)
  }
  if (sort?.direction) {
    params.set('sort_dir', sort.direction)
  }
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const response = await fetch(`${API_BASE_URL}/api/trips?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load trips')
  }
  const data = await response.json()
  return normalizePagedResponse(data)
}

export const fetchTripsAll = async (search = '', filters = {}) => {
  const trimmedSearch = search.trim()
  const params = {
    ...filters,
    ...(trimmedSearch ? { search: trimmedSearch } : {})
  }
  return fetchAllPagesWithParams('/api/trips', params)
}

export const updateTrip = async (id, tripData) => {
  const response = await fetch(`${API_BASE_URL}/api/trips`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...tripData, trip_id: id })
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to update trip')
  }
  return response.json()
}

export const deleteTrip = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/trips/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to delete trip')
  }
  return response
}
