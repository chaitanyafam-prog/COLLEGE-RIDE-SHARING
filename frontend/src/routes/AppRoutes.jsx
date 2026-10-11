import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/useAuth.js'
import Dashboard from '../pages/Dashboard.jsx'
import Login from '../pages/Login.jsx'
import PostRide from '../pages/PostRide.jsx'
import Register from '../pages/Register.jsx'
import SearchRides from '../pages/SearchRides.jsx'

// Login/Register bounce to the dashboard when already signed in.
function GuestOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Navigate to="/" replace /> : children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/rides" element={<ProtectedRoute><SearchRides /></ProtectedRoute>} />
      <Route path="/rides/new" element={<ProtectedRoute role="driver"><PostRide /></ProtectedRoute>} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
