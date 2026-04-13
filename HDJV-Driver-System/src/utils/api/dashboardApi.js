import { API_BASE_URL, getAuthHeaders, handleApiError } from './baseApi.js'

export const fetchDashboardSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load dashboard summary')
  }
  return response.json()
}

export const fetchRoutesSummary = async () => {
  const response = await fetch(`${API_BASE_URL}/api/routes/summary`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load routes summary')
  }
  return response.json()
}

export const fetchApprovalSla = async (params = {}) => {
  const query = new URLSearchParams()
  if (params?.days) query.set('days', String(params.days))
  if (params?.sla_minutes) query.set('sla_minutes', String(params.sla_minutes))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const response = await fetch(`${API_BASE_URL}/api/dashboard/approval-sla${suffix}`, {
    headers: getAuthHeaders()
  })
  if (!response.ok) {
    await handleApiError(response, 'Unable to load approval SLA')
  }
  return response.json()
}
