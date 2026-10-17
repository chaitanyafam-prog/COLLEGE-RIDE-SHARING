import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client.js'
import { ErrorBanner } from '../components/FormField.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/useAuth.js'

const formatTime = (iso) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const statusStyle = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
}

function BookingCard({ booking, onChanged }) {
  const [method, setMethod] = useState('UPI')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (request) => {
    setBusy(true)
    setError('')
    try {
      await request()
      await onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => run(() => api.patch(`/bookings/${booking.booking_id}`, { status: 'cancelled' }))
  const pay = () => run(() => api.post(`/bookings/${booking.booking_id}/payment`, { method }))

  const canCancel = booking.status === 'pending' || (booking.status === 'accepted' && !booking.payment_status)
  const canPay = booking.status === 'accepted' && !booking.payment_status

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {booking.origin} <span className="text-slate-400">→</span> {booking.destination}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{formatTime(booking.departure_time)}</p>
          <p className="mt-2 text-sm text-slate-600">
            {booking.seats_booked} seat{booking.seats_booked > 1 ? 's' : ''} · ₹{Number(booking.total_price).toFixed(0)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[booking.status]}`}>
            {booking.status}
          </span>
          {booking.payment_status && (
            <span className="text-xs capitalize text-slate-500">Payment: {booking.payment_status}</span>
          )}
        </div>
      </div>

      {(canPay || canCancel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {canPay && (
            <>
              <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CASH">Cash (pay in person)</option>
              </select>
              <button onClick={pay} disabled={busy}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {busy ? 'Working…' : 'Pay now'}
              </button>
            </>
          )}
          {canCancel && (
            <button onClick={cancel} disabled={busy}
              className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60">
              Cancel
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </li>
  )
}

export default function MyBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setBookings((await api.get(`/riders/${user.user_id}/bookings`)).data)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [user.user_id])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <h1 className="text-2xl font-bold">My bookings</h1>
      <div className="mt-6 space-y-3">
        <ErrorBanner message={error} />
        {bookings === null && !error ? (
          <Spinner label="Loading bookings…" />
        ) : bookings && bookings.length === 0 ? (
          <p className="py-10 text-center text-slate-500">
            No bookings yet. <Link to="/rides" className="text-indigo-600 hover:underline">Find a ride</Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings?.map((b) => <BookingCard key={b.booking_id} booking={b} onChanged={load} />)}
          </ul>
        )}
      </div>
    </div>
  )
}
