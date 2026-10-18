import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api/client.js'
import FormField, { ErrorBanner, inputClass } from '../components/FormField.jsx'
import Spinner from '../components/Spinner.jsx'

const emptyVehicle = { plate_number: '', model: '', vehicle_type: 'car', capacity: 3 }
const emptyRide = { vehicle_id: '', origin_id: '', destination_id: '', departure_time: '', seats_offered: 1, price_per_seat: '' }

// value for <input type="datetime-local" min=...> in local time
const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function AddVehicleForm({ onAdded, onCancel }) {
  const [form, setForm] = useState(emptyVehicle)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.plate_number.trim().length < 3) return setError('Enter the vehicle plate number')
    if (!form.model.trim()) return setError('Enter the vehicle model')
    setBusy(true)
    try {
      const res = await api.post('/vehicles', { ...form, capacity: Number(form.capacity) })
      onAdded(res.data)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Add a vehicle</h2>
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Plate number" htmlFor="plate_number">
          <input id="plate_number" className={inputClass} value={form.plate_number} onChange={set('plate_number')} placeholder="TN01AB1234" />
        </FormField>
        <FormField label="Model" htmlFor="model">
          <input id="model" className={inputClass} value={form.model} onChange={set('model')} placeholder="Maruti Swift" />
        </FormField>
        <FormField label="Type" htmlFor="vehicle_type">
          <select id="vehicle_type" className={inputClass} value={form.vehicle_type} onChange={set('vehicle_type')}>
            <option value="car">Car</option>
            <option value="bike">Bike</option>
            <option value="auto">Auto</option>
          </select>
        </FormField>
        <FormField label="Passenger seats" htmlFor="capacity">
          <input id="capacity" type="number" min="1" max="8" className={inputClass} value={form.capacity} onChange={set('capacity')} />
        </FormField>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save vehicle'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default function PostRide() {
  const [locations, setLocations] = useState([])
  const [vehicles, setVehicles] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [form, setForm] = useState(emptyRide)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/locations'), api.get('/vehicles')])
      .then(([l, v]) => {
        setLocations(l.data)
        setVehicles(v.data)
        if (v.data.length === 1) setForm((f) => ({ ...f, vehicle_id: String(v.data[0].vehicle_id) }))
      })
      .catch((err) => setLoadError(errorMessage(err)))
  }, [])

  if (loadError) return <ErrorBanner message={loadError} />
  if (!vehicles) return <Spinner />

  const vehicle = vehicles.find((v) => String(v.vehicle_id) === form.vehicle_id)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const validate = () => {
    const e = {}
    if (!form.vehicle_id) e.vehicle_id = 'Choose a vehicle'
    if (!form.origin_id) e.origin_id = 'Choose a pickup point'
    if (!form.destination_id) e.destination_id = 'Choose a destination'
    else if (form.destination_id === form.origin_id) e.destination_id = 'Destination must differ from pickup'
    if (!form.departure_time) e.departure_time = 'Choose a departure time'
    else if (new Date(form.departure_time) <= new Date()) e.departure_time = 'Departure must be in the future'
    const seats = Number(form.seats_offered)
    if (!Number.isInteger(seats) || seats < 1) e.seats_offered = 'Offer at least 1 seat'
    else if (vehicle && seats > vehicle.capacity) e.seats_offered = `This vehicle has ${vehicle.capacity} passenger seat(s)`
    if (form.price_per_seat === '' || Number(form.price_per_seat) < 0) e.price_per_seat = 'Enter a price (0 for free)'
    return e
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await api.post('/rides', {
        vehicle_id: Number(form.vehicle_id),
        origin_id: Number(form.origin_id),
        destination_id: Number(form.destination_id),
        departure_time: form.departure_time.length === 16 ? form.departure_time + ':00' : form.departure_time,
        seats_offered: Number(form.seats_offered),
        price_per_seat: Number(form.price_per_seat),
      })
      setPosted(true)
      setForm({ ...emptyRide, vehicle_id: form.vehicle_id })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const locationSelect = (id, label) => (
    <FormField label={label} htmlFor={id} error={errors[id]}>
      <select id={id} className={inputClass} value={form[id]} onChange={set(id)}>
        <option value="">Select…</option>
        {locations.map((l) => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
      </select>
    </FormField>
  )

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-8">Post a ride</h1>

      {vehicles.length === 0 || addingVehicle ? (
        <div className="space-y-3">
          {vehicles.length === 0 && <p className="text-sm text-slate-600">Add the vehicle you will drive before posting a ride.</p>}
          <AddVehicleForm
            onAdded={(v) => {
              setVehicles([...vehicles, v])
              setForm((f) => ({ ...f, vehicle_id: String(v.vehicle_id) }))
              setAddingVehicle(false)
            }}
            onCancel={vehicles.length ? () => setAddingVehicle(false) : undefined}
          />
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4 border-t-2 border-slate-900 pt-6">
          {posted && (
            <div role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Ride posted! Riders can find it in <Link to="/rides" className="font-medium underline">Find a ride</Link>.
            </div>
          )}
          <ErrorBanner message={error} />
          <FormField label="Vehicle" htmlFor="vehicle_id" error={errors.vehicle_id}>
            <select id="vehicle_id" className={inputClass} value={form.vehicle_id} onChange={set('vehicle_id')}>
              <option value="">Select…</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.model} · {v.plate_number} ({v.capacity} seats)</option>
              ))}
            </select>
            <button type="button" onClick={() => setAddingVehicle(true)} className="mt-1 text-xs font-medium text-indigo-600">
              + Add another vehicle
            </button>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {locationSelect('origin_id', 'From')}
            {locationSelect('destination_id', 'To')}
          </div>
          <FormField label="Departure" htmlFor="departure_time" error={errors.departure_time}>
            <input id="departure_time" type="datetime-local" min={nowLocal()} className={inputClass}
              value={form.departure_time} onChange={set('departure_time')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Seats offered" htmlFor="seats_offered" error={errors.seats_offered}>
              <input id="seats_offered" type="number" min="1" max={vehicle?.capacity || 8} className={inputClass}
                value={form.seats_offered} onChange={set('seats_offered')} />
            </FormField>
            <FormField label="Price per seat (₹)" htmlFor="price_per_seat" error={errors.price_per_seat}>
              <input id="price_per_seat" type="number" min="0" step="1" className={inputClass}
                value={form.price_per_seat} onChange={set('price_per_seat')} />
            </FormField>
          </div>
          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {busy ? 'Posting…' : 'Post ride'}
          </button>
        </form>
      )}
    </div>
  )
}
