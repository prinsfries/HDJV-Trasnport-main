import { API_BASE_URL, setAuthToken } from './baseApi.js'

export const login = async (email, password, remember = true) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password, source: 'admin', remember })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Login failed. Please check your credentials.')
    }

    const data = await response.json()

    if (data.token) {
      setAuthToken(data.token, remember)
      localStorage.setItem('user', JSON.stringify(data.user))
    }

    return data
  } catch (err) {
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      throw new Error('Server connection failed. Please check your internet or try again later.')
    }
    throw err
  }
}
