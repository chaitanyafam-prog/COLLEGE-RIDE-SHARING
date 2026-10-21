import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

// active route gets a forest-green underline; no background fills
const linkClass = ({ isActive }) =>
  `border-b-2 py-1 text-[15px] text-slate-700 transition-colors hover:border-slate-400 ${isActive ? 'border-indigo-600 font-semibold text-slate-900' : 'border-transparent'}`

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="panel !px-6 !py-3">
      <nav aria-label="Primary" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link to="/" className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight text-slate-900 no-underline">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-600" fill="currentColor" aria-hidden="true">
            <path d="M20 4C10 4 5 9 5 15c0 1.2.3 2.3.8 3.2L3.5 20.5 5 22l2.3-2.3c.9.5 2 .8 3.2.8 6 0 10.5-5 9.5-16.5Z" />
          </svg>
          Campus Rides
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {user ? (
            <>
              <NavLink to="/rides" end className={linkClass}>Find a ride</NavLink>
              {user.roles.includes('rider') && <NavLink to="/bookings" className={linkClass}>My bookings</NavLink>}
              {user.roles.includes('driver') && <NavLink to="/rides/new" className={linkClass}>Post a ride</NavLink>}
              <span className="hidden items-center gap-2 text-[15px] text-slate-600 sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-indigo-600" aria-hidden="true">
                  {user.name?.[0]?.toUpperCase()}
                </span>
                {user.name}
              </span>
              <button onClick={handleLogout} className="border-b-2 border-transparent py-1 text-[15px] text-slate-700 transition-colors hover:border-slate-400">
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Log in</NavLink>
              <Link to="/register" className="rounded-md bg-indigo-600 px-4 py-1.5 text-[15px] font-medium text-slate-50 no-underline transition-colors hover:bg-indigo-700">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
