import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

const features = [
  { title: 'Search rides', text: 'Find a ride to the airport, station or mall.', to: '/rides' },
  { title: 'Post a ride', text: 'Offer seats on your next trip.', role: 'driver', to: '/rides/new' },
  { title: 'My bookings', text: 'Track requests and payments.', role: 'rider' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const visible = features.filter((f) => !f.role || user.roles.includes(f.role))

  return (
    <div>
      <h1 className="text-2xl font-bold">Hello, {user.name}</h1>
      <div className="mt-2 flex gap-2">
        {user.roles.map((r) => (
          <span key={r} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-700">
            {r}
          </span>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {visible.map((f) => {
          const card = (
            <>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{f.text}</p>
              {!f.to && <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Coming soon</p>}
            </>
          )
          return f.to ? (
            <Link key={f.title} to={f.to} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-400">
              {card}
            </Link>
          ) : (
            <div key={f.title} className="rounded-lg border border-dashed border-slate-300 bg-white p-5">{card}</div>
          )
        })}
      </div>
    </div>
  )
}
