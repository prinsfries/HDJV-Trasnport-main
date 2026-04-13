import { navigateToLogin } from '../navigation.js'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')

export const getAuthToken = () => {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
}

export const setAuthToken = (token, remember = true) => {
  if (remember) {
    localStorage.setItem('auth_token', token)
    sessionStorage.removeItem('auth_token')
  } else {
    sessionStorage.setItem('auth_token', token)
    localStorage.removeItem('auth_token')
  }
}

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token')
  sessionStorage.removeItem('auth_token')
}

export const getAuthHeaders = () => {
  const token = getAuthToken()
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

export const handleApiError = async (response, customMessage = null) => {
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({}))
    removeAuthToken()
    localStorage.removeItem('user')
    navigateToLogin()
    throw new Error(errorData.message || 'Authentication required. Please login again.')
  }

  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'You do not have permission to perform this action.')
  }

  if (customMessage) {
    throw new Error(customMessage)
  }

  const errorData = await response.json().catch(() => ({}))
  throw new Error(errorData.message || 'Request failed. Please try again.')
}

export const fetchAllPages = async (path, limit = 200, maxPages = 50) => {
  const firstPageParams = new URLSearchParams({
    page: '1',
    limit: limit.toString()
  })

  const firstResponse = await fetch(`${API_BASE_URL}${path}?${firstPageParams}`, {
    headers: getAuthHeaders()
  })

  if (!firstResponse.ok) {
    await handleApiError(firstResponse, 'Unable to load data')
  }

  const firstData = await firstResponse.json().catch(() => [])
  const firstPageItems = Array.isArray(firstData) ? firstData : (Array.isArray(firstData?.data) ? firstData.data : [])

  if (firstPageItems.length < limit) {
    return firstPageItems
  }

  const hasTotal = typeof firstData.total === 'number' || typeof firstData.total_count === 'number'
  const totalItems = typeof firstData.total === 'number' ? firstData.total :
    typeof firstData.total_count === 'number' ? firstData.total_count :
      firstPageItems.length
  const totalPagesNeeded = Math.min(Math.ceil(totalItems / limit), maxPages)

  if (!hasTotal) {
    const results = [...firstPageItems]
    let page = 2
    while (page <= maxPages) {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      const response = await fetch(`${API_BASE_URL}${path}?${params}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        await handleApiError(response, 'Unable to load data')
      }

      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)

      if (pageItems.length < limit) {
        break
      }

      page += 1
    }
    return results
  }

  if (totalPagesNeeded <= 2) {
    const results = [...firstPageItems]

    for (let page = 2; page <= totalPagesNeeded; page++) {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      const response = await fetch(`${API_BASE_URL}${path}?${params}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        await handleApiError(response, 'Unable to load data')
      }

      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)
    }

    return results
  }

  const remainingPages = []
  for (let page = 2; page <= totalPagesNeeded; page++) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })
    remainingPages.push(
      fetch(`${API_BASE_URL}${path}?${params}`, {
        headers: getAuthHeaders()
      })
    )
  }

  const remainingResponses = await Promise.allSettled(remainingPages)

  const results = [...firstPageItems]
  const errors = []
  let successfulPages = 1

  for (let i = 0; i < remainingResponses.length; i++) {
    const responseResult = remainingResponses[i]
    const pageNumber = i + 2

    if (responseResult.status === 'rejected') {
      errors.push(`Page ${pageNumber}: ${responseResult.reason?.message || 'Network error'}`)
      continue
    }

    const response = responseResult.value
    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error')
      errors.push(`Page ${pageNumber}: HTTP ${response.status} - ${errorMessage}`)
      continue
    }

    try {
      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)
      successfulPages++
    } catch (error) {
      console.error('Error parsing response:', error)
      errors.push(`Page ${pageNumber}: Failed to parse response`)
    }
  }

  if (errors.length > 0) {
    const errorSummary = `Failed to load ${errors.length} page(s). Successfully loaded ${successfulPages}/${totalPagesNeeded} pages. Errors: ${errors.join('; ')}`
    throw new Error(errorSummary)
  }

  return results
}

export const fetchAllPagesWithParams = async (path, params = {}, limit = 200, maxPages = 50) => {
  const firstPageParams = new URLSearchParams({
    page: '1',
    limit: limit.toString(),
    ...params
  })

  const firstResponse = await fetch(`${API_BASE_URL}${path}?${firstPageParams}`, {
    headers: getAuthHeaders()
  })

  if (!firstResponse.ok) {
    await handleApiError(firstResponse, 'Unable to load data')
  }

  const firstData = await firstResponse.json().catch(() => [])
  const firstPageItems = Array.isArray(firstData) ? firstData : (Array.isArray(firstData?.data) ? firstData.data : [])

  if (firstPageItems.length < limit) {
    return firstPageItems
  }

  const hasTotal = typeof firstData.total === 'number' || typeof firstData.total_count === 'number'
  const totalItems = typeof firstData.total === 'number' ? firstData.total :
    typeof firstData.total_count === 'number' ? firstData.total_count :
      firstPageItems.length
  const totalPagesNeeded = Math.min(Math.ceil(totalItems / limit), maxPages)

  if (!hasTotal) {
    const results = [...firstPageItems]
    let page = 2
    while (page <= maxPages) {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...params
      })
      const response = await fetch(`${API_BASE_URL}${path}?${searchParams}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        await handleApiError(response, 'Unable to load data')
      }

      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)

      if (pageItems.length < limit) {
        break
      }

      page += 1
    }
    return results
  }

  if (totalPagesNeeded <= 2) {
    const results = [...firstPageItems]

    for (let page = 2; page <= totalPagesNeeded; page++) {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...params
      })
      const response = await fetch(`${API_BASE_URL}${path}?${searchParams}`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        await handleApiError(response, 'Unable to load data')
      }

      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)
    }

    return results
  }

  const remainingPages = []
  for (let page = 2; page <= totalPagesNeeded; page++) {
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...params
    })
    remainingPages.push(
      fetch(`${API_BASE_URL}${path}?${searchParams}`, {
        headers: getAuthHeaders()
      })
    )
  }

  const remainingResponses = await Promise.allSettled(remainingPages)

  const results = [...firstPageItems]
  const errors = []
  let successfulPages = 1

  for (let i = 0; i < remainingResponses.length; i++) {
    const responseResult = remainingResponses[i]
    const pageNumber = i + 2

    if (responseResult.status === 'rejected') {
      errors.push(`Page ${pageNumber}: ${responseResult.reason?.message || 'Network error'}`)
      continue
    }

    const response = responseResult.value
    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error')
      errors.push(`Page ${pageNumber}: HTTP ${response.status} - ${errorMessage}`)
      continue
    }

    try {
      const data = await response.json().catch(() => [])
      const pageItems = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : [])
      results.push(...pageItems)
      successfulPages++
    } catch (error) {
      console.error('Error parsing response:', error)
      errors.push(`Page ${pageNumber}: Failed to parse response`)
    }
  }

  if (errors.length > 0) {
    const errorSummary = `Failed to load ${errors.length} page(s). Successfully loaded ${successfulPages}/${totalPagesNeeded} pages. Errors: ${errors.join('; ')}`
    throw new Error(errorSummary)
  }

  return results
}

export const normalizePagedResponse = (data) => {
  if (Array.isArray(data)) {
    return { items: data, total: data.length }
  }
  if (data && Array.isArray(data.data)) {
    return {
      items: data.data,
      total: typeof data.total === 'number'
        ? data.total
        : (typeof data.total_count === 'number' ? data.total_count : data.data.length)
    }
  }
  return { items: [], total: 0 }
}
