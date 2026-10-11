import axios from 'axios'

export const TOKEN_KEY = 'token'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// AuthContext registers its logout here so a rejected token signs the user out.
let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || ''
    const isAuthForm = url.startsWith('/auth/login') || url.startsWith('/auth/register')
    // a 401 on the login/register forms just means bad credentials, not an expired session
    if (error.response?.status === 401 && !isAuthForm) onUnauthorized()
    return Promise.reject(error)
  },
)

// Turn an axios/FastAPI error into a readable string.
export function errorMessage(error) {
  if (!error.response) return 'Cannot reach the server. Is the backend running?'
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg.replace(/^Value error, /, '')).join('. ')
  }
  return 'Something went wrong. Please try again.'
}

export default api
