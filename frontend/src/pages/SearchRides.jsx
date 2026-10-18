import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client.js'
import FormField, { ErrorBanner, inputClass } from '../components/FormField.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/useAuth.js'

const formatTime = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function RideCard({ ride, canBook }) {
  const [seats, setSeats] = useState(1)
  const [state, setState] = useState({ status: 'idle', message: '' })

  const book = async () => {
    setState({ status: 'busy', message: '' })
    try {
      await api.post('/bookings', { ride_id: ride.ride_id, seats_booked: seats })
      setState({ status: 'done', message: 'Request sent. The driver will accept or reject it.' })
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) })
    }
  }

  return (
    <li>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2>
            {ride.origin} <span className="text-slate-400">→</span> {ride.destination}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{formatTime(ride.departure_time)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {ride.driver_name} · ★ {ride.rating} · {ride.model} ({ride.vehicle_type})
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold leading-none text-slate-900">₹{Number(ride.price_per_seat).toFixed(0)}</p>
          <p className="text-xs text-slate-500">per seat · {ride.seats_available} left</p>
        </div>
      </div>

      {canBook && state.status !== 'done' && (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor={`seats-${ride.ride_id}`}>Seats</label>
          <select id={`seats-${ride.ride_id}`} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-base">
            {Array.from({ length: ride.seats_available }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
          </select>
          <button onClick={book} disabled={state.status === 'busy'}
            className="ml-auto rounded-md bg-indigo-600 px-4 py-1.5 text-base font-medium text-slate-50 hover:bg-indigo-700 disabled:opacity-60">
            {state.status === 'busy' ? 'Requesting…' : 'Request seat'}
          </button>
        </div>
      )}
      {state.status === 'done' && <p className="mt-3 text-sm font-semibold text-green-700">{state.message}</p>}
      {state.status === 'error' && <p className="mt-3 text-sm text-red-600">{state.message}</p>}
    </li>
  )
}

export default function SearchRides() {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [filters, setFilters] = useState({ origin_id: '', destination_id: '', on_date: '' })
  const [rides, setRides] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const search = useCallback(async (f) => {
    setLoading(true)
    setError('')
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''))
      setRides((await api.get('/rides', { params })).data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // initial load (loading is already true); later searches go through search()
    api.get('/locations').then((res) => setLocations(res.data)).catch((err) => setError(errorMessage(err)))
    api.get('/rides')
      .then((res) => setRides(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })
  const onSubmit = (e) => {
    e.preventDefault()
    search(filters)
  }
  const clear = () => {
    const empty = { origin_id: '', destination_id: '', on_date: '' }
    setFilters(empty)
    search(empty)
  }

  const locationSelect = (id, label) => (
    <FormField label={label} htmlFor={id}>
      <select id={id} className={inputClass} value={filters[id]} onChange={set(id)}>
        <option value="">Anywhere</option>
        {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
      </select>
    </FormField>
  )

  return (
    <div>
      <p className="eyebrow">Rides</p>
      <h1 className="mt-3">Find a ride</h1>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 border-t-2 border-slate-900 pt-4 sm:grid-cols-12 sm:items-end sm:[&>*:nth-child(-n+2)]:col-span-4 sm:[&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(4)]:col-span-2">
        {locationSelect('origin_id', 'From')}
        {locationSelect('destination_id', 'To')}
        <FormField label="Date" htmlFor="on_date">
          <input id="on_date" type="date" className={inputClass} value={filters.on_date} onChange={set('on_date')} />
        </FormField>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-base font-medium text-slate-50 hover:bg-indigo-700">
            Search
          </button>
          <button type="button" onClick={clear} className="rounded-md border border-slate-300 px-3 py-2 text-base hover:border-slate-900">
            Clear
          </button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        <ErrorBanner message={error} />
        {loading ? (
          <Spinner label="Searching rides…" />
        ) : rides && rides.length === 0 ? (
          <div className="border-y border-slate-300 py-10"><h2>No rides match</h2><p className="mt-1 text-slate-500">Try a different pickup, destination or date, or clear the filters.</p></div>
        ) : (
          <ul className="ledger">
            {rides?.map((r) => (
              <RideCard key={r.ride_id} ride={r}
                canBook={user.roles.includes('rider') && r.driver_id !== user.user_id} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
