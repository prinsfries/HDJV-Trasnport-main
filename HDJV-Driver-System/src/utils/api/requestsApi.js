import { API_BASE_URL, fetchAllPagesWithParams, getAuthHeaders, handleApiError, normalizePagedResponse } from './baseApi.js'

export const fetchRequests = async (page = 1, limit = 50, search = '', sort = {}, filters = {}) => {
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
  const response = await fetch(`${API_BASE_URL}/api/requests?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load requests')
  }
  const data = await response.json()
  return normalizePagedResponse(data)
}

export const fetchRequestsAll = async (search = '', filters = {}) => {
  const trimmedSearch = search.trim()
  const params = {
    ...filters,
    ...(trimmedSearch ? { search: trimmedSearch } : {})
  }
  return fetchAllPagesWithParams('/api/requests', params)
}

export const fetchRequestById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load request')
  }
  return response.json()
}

export const decideRequest = async (id, decision) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}/decision`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ decision })
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to update request')
  }
  return response.json()
}

export const assignRequest = async (id, driverId, vehicleId) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}/assign`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      driver_id: driverId,
      ...(vehicleId ? { vehicle_id: vehicleId } : {})
    })
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to assign driver')
  }
  return response.json()
}

export const updateRequestStatus = async (id, status) => {
  const response = await fetch(`${API_BASE_URL}/api/requests/${id}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to update request status')
  }
  return response.json()
}
