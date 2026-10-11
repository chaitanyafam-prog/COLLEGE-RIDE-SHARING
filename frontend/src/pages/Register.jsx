import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../api/client.js'
import FormField, { ErrorBanner, inputClass } from '../components/FormField.jsx'
import { useAuth } from '../context/useAuth.js'

const initial = {
  name: '', email: '', password: '', confirm: '', dob: '', college_id: '', clg_id: '',
  phone: '', roles: ['rider'], license_no: '', emergency_contact: '',
}

function validate(f, college) {
  const e = {}
  if (!f.name.trim()) e.name = 'Name is required'
  const domain = college?.email_domain || 'vitstudent.ac.in'
  if (!f.email.trim().toLowerCase().endsWith('@' + domain)) e.email = `Email must end with @${domain}`
  if (f.password.length < 8) e.password = 'Password must be at least 8 characters'
  if (f.confirm !== f.password) e.confirm = 'Passwords do not match'
  if (!f.dob) e.dob = 'Date of birth is required'
  else if (new Date(f.dob) >= new Date()) e.dob = 'Date of birth must be in the past'
  if (!f.college_id) e.college_id = 'Select your college'
  if (!/^[A-Za-z0-9]{5,15}$/.test(f.clg_id.trim())) e.clg_id = 'College ID must be 5-15 letters/digits, e.g. 24BCE1001'
  if (f.phone && !/^\d{10,15}$/.test(f.phone)) e.phone = 'Enter 10-15 digits'
  if (f.roles.length === 0) e.roles = 'Choose at least one role'
  if (f.roles.includes('driver') && !f.license_no.trim()) e.license_no = 'License number is required for drivers'
  if (f.roles.includes('rider') && !/^\d{10,15}$/.test(f.emergency_contact)) e.emergency_contact = 'Emergency contact (10-15 digits) is required for riders'
  return e
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [colleges, setColleges] = useState([])
  const [collegesError, setCollegesError] = useState('')
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.get('/colleges')
      .then((res) => {
        setColleges(res.data)
        if (res.data.length === 1) setForm((f) => ({ ...f, college_id: String(res.data[0].college_id) }))
      })
      .catch((err) => setCollegesError(errorMessage(err)))
  }, [])

  const college = colleges.find((c) => String(c.college_id) === form.college_id)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const toggleRole = (role) =>
    setForm({ ...form, roles: form.roles.includes(role) ? form.roles.filter((r) => r !== role) : [...form.roles, role] })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const found = validate(form, college)
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        dob: form.dob,
        college_id: Number(form.college_id),
        clg_id: form.clg_id.trim(),
        roles: form.roles,
        phone: form.phone || null,
        license_no: form.roles.includes('driver') ? form.license_no.trim() : null,
        emergency_contact: form.roles.includes('rider') ? form.emergency_contact : null,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  const text = (id, label, extra = {}) => (
    <FormField label={label} htmlFor={id} error={errors[id]}>
      <input id={id} className={inputClass} value={form[id]} onChange={set(id)} {...extra} />
    </FormField>
  )

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ErrorBanner message={error || collegesError} />
        {text('name', 'Full name', { autoComplete: 'name' })}
        <FormField label="College" htmlFor="college_id" error={errors.college_id}>
          <select id="college_id" className={inputClass} value={form.college_id} onChange={set('college_id')}>
            <option value="">Select your college</option>
            {colleges.map((c) => <option key={c.college_id} value={c.college_id}>{c.name}</option>)}
          </select>
        </FormField>
        {text('email', 'College email', { type: 'email', autoComplete: 'email', placeholder: `you@${college?.email_domain || 'vitstudent.ac.in'}` })}
        {text('clg_id', 'College ID / registration number', { placeholder: '24BCE1001' })}
        {text('dob', 'Date of birth', { type: 'date' })}
        {text('phone', 'Phone (optional)', { type: 'tel', inputMode: 'numeric' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
          {text('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">I want to use Campus Rides as a</legend>
          <div className="flex gap-6">
            {['rider', 'driver'].map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm capitalize">
                <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                {role}
              </label>
            ))}
          </div>
          {errors.roles && <p className="mt-1 text-xs text-red-600">{errors.roles}</p>}
        </fieldset>

        {form.roles.includes('rider') && text('emergency_contact', 'Emergency contact number', { type: 'tel', inputMode: 'numeric' })}
        {form.roles.includes('driver') && text('license_no', 'Driving license number')}

        <button type="submit" disabled={submitting}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered? <Link to="/login" className="font-medium text-indigo-600">Log in</Link>
      </p>
    </div>
  )
}
