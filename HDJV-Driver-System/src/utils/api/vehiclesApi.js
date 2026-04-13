import { API_BASE_URL, fetchAllPagesWithParams, getAuthHeaders, handleApiError, normalizePagedResponse } from './baseApi.js'

export const fetchVehicles = async (page = 1, limit = 50, search = '', sort = {}, filters = {}) => {
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
  const response = await fetch(`${API_BASE_URL}/api/vehicles?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load vehicles')
  }
  const data = await response.json()
  return normalizePagedResponse(data)
}

export const fetchVehiclesAll = async (search = '', filters = {}) => {
  const trimmedSearch = search.trim()
  const params = {
    ...filters,
    ...(trimmedSearch ? { search: trimmedSearch } : {})
  }
  return fetchAllPagesWithParams('/api/vehicles', params)
}

export const fetchVehicleById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load vehicle')
  }
  return response.json()
}

export const createVehicle = async (vehicleData) => {
  const response = await fetch(`${API_BASE_URL}/api/vehicles`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(vehicleData)
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to create vehicle')
  }
  return response.json()
}

export const updateVehicle = async (id, vehicleData) => {
  const response = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(vehicleData)
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to update vehicle')
  }
  return response.json()
}

export const deleteVehicle = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to delete vehicle')
  }
  return response
}
