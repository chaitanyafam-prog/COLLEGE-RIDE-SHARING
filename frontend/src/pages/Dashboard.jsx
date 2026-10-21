import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const sections = [
  { no: '01', title: 'Search rides', text: 'Find a ride to the airport, station or mall.', to: '/rides' },
  { no: '02', title: 'Post a ride', text: 'Offer seats on your next trip.', role: 'driver', to: '/rides/new' },
  { no: '03', title: 'Ride requests', text: 'Review requests and approve riders.', role: 'driver', to: '/driver/bookings' },
  { no: '04', title: 'My bookings', text: 'Track requests and payments.', role: 'rider', to: '/bookings' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const visible = sections.filter((s) => !s.role || user.roles.includes(s.role))

  return (
    <div className="grid gap-x-8 gap-y-8 md:grid-cols-12">
      <header className="md:col-span-5">
        <p className="eyebrow">{user.roles.join(' · ')}</p>
        <h1 className="mt-3">Hello, {user.name}</h1>
      </header>

      <nav aria-label="Sections" className="md:col-span-7">
        <div className="ledger">
          {visible.map((s) => (
            <Link key={s.title} to={s.to} className="ledger-row grid grid-cols-[48px_1fr] items-baseline no-underline">
              <span className="text-sm text-slate-500">{s.no}</span>
              <div>
                <h2 className="text-slate-900">{s.title}</h2>
                <p className="mt-1 text-slate-500">{s.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
