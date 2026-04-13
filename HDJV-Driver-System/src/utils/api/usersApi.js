import { API_BASE_URL, fetchAllPagesWithParams, getAuthHeaders, handleApiError, normalizePagedResponse } from './baseApi.js'

export const fetchUsers = async (page = 1, limit = 50, search = '', sort = {}, filters = {}) => {
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
  const response = await fetch(`${API_BASE_URL}/api/users?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load users')
  }
  const data = await response.json()
  return normalizePagedResponse(data)
}

export const fetchUsersAll = async (search = '', filters = {}) => {
  const trimmedSearch = search.trim()
  const params = {
    ...filters,
    ...(trimmedSearch ? { search: trimmedSearch } : {})
  }
  return fetchAllPagesWithParams('/api/users', params)
}

export const fetchAccounts = async (page = 1, limit = 50, search = '', sort = {}, filters = {}) => {
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
  params.set('include_credentials', '1')
  const response = await fetch(`${API_BASE_URL}/api/users?${params}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load accounts')
  }
  const data = await response.json()
  return normalizePagedResponse(data)
}

export const fetchAccountsAll = async (search = '', filters = {}) => {
  const trimmedSearch = search.trim()
  const params = {
    ...filters,
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
    include_credentials: 1
  }
  return fetchAllPagesWithParams('/api/users', params)
}

export const createUser = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData)
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to create user')
  }
  return response.json()
}

export const updateUser = async (id, userData) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(userData)
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to update user')
  }
  return response.json()
}

export const deleteUser = async (id) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to delete user')
  }
  return response
}
