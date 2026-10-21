import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client.js'
import { ErrorBanner } from '../components/FormField.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/useAuth.js'

const selectClass = 'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900'

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
      fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

  const dt = new Date(ride.departure_time)
  const day = dt.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const clock = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const initial = ride.driver_name?.[0]?.toUpperCase()
  const seatsLeft = `${ride.seats_available} seat${ride.seats_available === 1 ? '' : 's'} left`

  return (
    <li>
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8">
        <div className="flex shrink-0 items-baseline gap-3 sm:block sm:w-32">
          <p className="text-base text-slate-500">{day}</p>
          <p className="font-serif text-2xl font-semibold leading-tight text-slate-900 sm:mt-0.5">{clock}</p>
        </div>

        <div className="min-w-0 flex-1 sm:basis-72 sm:border-l sm:border-slate-200 sm:pl-8">
          <div className="flex gap-4">
            <div className="flex flex-col items-center py-2" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              <span className="my-1 w-px flex-1 bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full border-2 border-indigo-600 bg-white" />
            </div>
            <div className="min-w-0">
              <h2 className="!text-[1.375rem] leading-snug">{ride.origin}</h2>
              <p className="mt-1 font-serif text-[1.375rem] font-semibold leading-snug text-slate-900">{ride.destination}</p>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 pt-3 text-[15px] text-slate-600">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-indigo-600" aria-hidden="true">{initial}</span>
            <span className="font-medium text-slate-900">{ride.driver_name}</span>
            {ride.rating != null && <span>★ {ride.rating}</span>}
            <span className="text-slate-400">·</span>
            <span>{ride.model} ({ride.vehicle_type})</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:ml-auto sm:w-64 sm:items-end sm:text-right">
          <div>
            <p className="font-serif text-3xl font-bold sm:text-4xl leading-none text-indigo-600">₹{Number(ride.price_per_seat).toFixed(0)}</p>
            <p className="mt-1 text-[15px] text-slate-500">per seat · {seatsLeft}</p>
          </div>
          {canBook && state.status !== 'done' && (
            <div className="flex items-center gap-2 max-sm:[&>*:last-child]:flex-1">
              {ride.seats_available > 1 && (
                <>
                  <label className="sr-only" htmlFor={`seats-${ride.ride_id}`}>Seats</label>
                  <div className="relative">
                    <select id={`seats-${ride.ride_id}`} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
                      className="h-11 appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-9 text-base">
                      {Array.from({ length: ride.seats_available }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                </>
              )}
              <button onClick={book} disabled={state.status === 'busy'}
                className="h-11 rounded-md bg-indigo-600 px-5 text-base font-medium text-slate-50 transition-colors hover:bg-indigo-700">
                {state.status === 'busy' ? 'Requesting…' : 'Request seat'}
              </button>
            </div>
          )}
        </div>
      </div>
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
  const [sort, setSort] = useState('earliest')

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
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <select id={id} className={`${selectClass} appearance-none pr-10`} value={filters[id]} onChange={set(id)}>
          <option value="">Anywhere</option>
          {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
        </select>
        <Chevron />
      </div>
    </div>
  )

  const sorted = rides && [...rides].sort((a, b) =>
    sort === 'price'
      ? Number(a.price_per_seat) - Number(b.price_per_seat)
      : new Date(a.departure_time) - new Date(b.departure_time))

  return (
    <div className="space-y-8">
      <section>
        <p className="eyebrow">Your campus, connected</p>
        <h1 className="mt-3">Where are you headed?</h1>
        <p className="mt-2 text-lg text-slate-600 sm:text-xl">Find a seat, share the journey, and make campus life a little easier.</p>

        <form onSubmit={onSubmit}
          className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-100 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1fr_1fr_minmax(12rem,0.9fr)_auto] lg:items-end">
          {locationSelect('origin_id', 'From')}
          {locationSelect('destination_id', 'To')}
          <div className="min-w-0">
            <label htmlFor="on_date" className="mb-1.5 block text-[15px] font-semibold text-slate-700">Date</label>
            <input id="on_date" type="date" className={selectClass} value={filters.on_date} onChange={set('on_date')} />
          </div>
          <div className="flex gap-2 sm:col-span-2 md:col-span-3 lg:col-span-1">
            <button type="submit"
              className="h-11 flex-1 rounded-md bg-indigo-600 px-5 text-base font-medium text-slate-50 transition-colors hover:bg-indigo-700">
              Search rides
            </button>
            <button type="button" onClick={clear}
              className="h-11 rounded-md border border-slate-300 px-4 text-base text-slate-600 transition-colors hover:border-slate-900 hover:text-slate-900">
              Clear
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="!text-2xl">Available rides</h2>
          <div className="flex items-center gap-4 text-[15px] text-slate-600">
            {rides && <span>{rides.length} ride{rides.length === 1 ? '' : 's'} found</span>}
            <label className="sr-only" htmlFor="sort">Sort rides</label>
            <div className="relative">
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}
                className="h-10 appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-9 text-[15px] text-slate-900">
                <option value="earliest">Earliest first</option>
                <option value="price">Lowest price</option>
              </select>
              <Chevron />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <ErrorBanner message={error} />
          {loading ? (
            <Spinner label="Searching rides…" />
          ) : sorted && sorted.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white/90 py-10 text-center">
              <h2>No rides match</h2>
              <p className="mt-1 text-slate-500">Try a different pickup, destination or date, or clear the filters.</p>
            </div>
          ) : (
            <ul className="ledger">
              {sorted?.map((r) => (
                <RideCard key={r.ride_id} ride={r}
                  canBook={user.roles.includes('rider') && r.driver_id !== user.user_id} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
