import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api/client.js'
import { ErrorBanner } from '../components/FormField.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/useAuth.js'

const formatTime = (iso) => new Date(iso).toLocaleString([], {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

export default function DriverBookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setBookings((await api.get(`/drivers/${user.user_id}/bookings`)).data)
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [user.user_id])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const decide = async (bookingId, status) => {
    setBusyId(bookingId)
    setError('')
    try {
      await api.patch(`/bookings/${bookingId}`, { status })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <p className="eyebrow">Driver</p>
      <h1 className="mt-3">Ride requests</h1>
      <p className="mt-2 text-slate-600">Approve a request to notify the rider that their seat is confirmed and ready for payment.</p>
      <div className="mt-8 space-y-3">
        <ErrorBanner message={error} />
        {bookings === null && !error ? <Spinner label="Loading requests…" /> : bookings?.length === 0 ? (
          <div className="border-y border-slate-300 py-10">
            <h2>No ride requests yet</h2>
            <p className="mt-1 text-slate-500">Requests for your rides will appear here.</p>
          </div>
        ) : (
          <ul className="ledger">
            {bookings?.map((booking) => (
              <li key={booking.booking_id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2>{booking.origin} <span className="text-slate-400">→</span> {booking.destination}</h2>
                    <p className="mt-1 text-sm text-slate-500">{formatTime(booking.departure_time)}</p>
                    <p className="mt-2 text-slate-700">{booking.rider_name} · {booking.seats_booked} seat{booking.seats_booked === 1 ? '' : 's'} · ₹{Number(booking.total_price).toFixed(0)}</p>
                    <p className="text-sm text-slate-500">{booking.rider_email}</p>
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">{booking.status}</span>
                </div>
                {booking.status === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <button disabled={busyId === booking.booking_id} onClick={() => decide(booking.booking_id, 'accepted')}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                      {busyId === booking.booking_id ? 'Saving…' : 'Approve and notify rider'}
                    </button>
                    <button disabled={busyId === booking.booking_id} onClick={() => decide(booking.booking_id, 'rejected')}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:border-slate-900">
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
