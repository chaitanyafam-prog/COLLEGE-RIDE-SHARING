import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import Spinner from './Spinner.jsx'

// Wrap a page: <ProtectedRoute role="driver"><Page /></ProtectedRoute>
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (role && !user.roles.includes(role)) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        This page is only available to {role}s.
      </div>
    )
  }
  return children
}
