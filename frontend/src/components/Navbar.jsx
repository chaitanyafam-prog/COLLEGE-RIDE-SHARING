import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

// active route gets a sage underline rule; no background fills
const linkClass = ({ isActive }) =>
  `border-b-2 py-1 text-base text-slate-700 hover:border-slate-400 ${isActive ? 'border-slate-400 font-semibold' : 'border-transparent'}`

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="border-b-2 border-slate-900">
      <nav aria-label="Primary" className="mx-auto flex max-w-5xl items-baseline justify-between px-4 py-4">
        <Link to="/" className="text-2xl font-extrabold tracking-tight text-slate-900 no-underline">
          Campus Rides
        </Link>
        <div className="flex items-baseline gap-6">
          {user ? (
            <>
              <NavLink to="/rides" end className={linkClass}>Find a ride</NavLink>
              {user.roles.includes('rider') && <NavLink to="/bookings" className={linkClass}>My bookings</NavLink>}
              {user.roles.includes('driver') && <NavLink to="/rides/new" className={linkClass}>Post a ride</NavLink>}
              <span className="hidden text-sm italic text-slate-500 sm:inline">{user.name}</span>
              <button onClick={handleLogout} className="border-b-2 border-transparent py-1 text-base text-slate-700 hover:border-slate-400">
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Log in</NavLink>
              <Link to="/register" className="rounded-md bg-indigo-600 px-4 py-1.5 text-base font-medium text-slate-50 no-underline hover:bg-indigo-700">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
