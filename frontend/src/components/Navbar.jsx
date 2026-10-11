import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const linkClass = 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-indigo-600">
          Campus Rides
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NavLink to="/rides" className={linkClass}>Find a ride</NavLink>
              {user.roles.includes('driver') && <NavLink to="/rides/new" className={linkClass}>Post a ride</NavLink>}
              <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
              <button onClick={handleLogout} className={linkClass}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={linkClass}>
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
