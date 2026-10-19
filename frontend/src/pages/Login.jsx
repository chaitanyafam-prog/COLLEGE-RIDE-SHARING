import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client.js'
import FormField, { ErrorBanner, inputClass } from '../components/FormField.jsx'
import { useAuth } from '../context/useAuth.js'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(form.email, form.password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-5xl">Log in</h1>
        <p className="mb-8 text-lg text-slate-500">Welcome back. Log in with your college email to find or post rides.</p>
        <form onSubmit={onSubmit} className="space-y-6 border-t-2 border-slate-900 pt-8">
          <ErrorBanner message={error} />
          <FormField label="College email" htmlFor="email">
            <input id="email" type="email" required autoComplete="email" className={`${inputClass} !px-4 !py-3 !text-lg`}
              value={form.email} onChange={set('email')} placeholder="you@vitstudent.ac.in" />
          </FormField>
          <FormField label="Password" htmlFor="password">
            <input id="password" type="password" required autoComplete="current-password" className={`${inputClass} !px-4 !py-3 !text-lg`}
              value={form.password} onChange={set('password')} />
          </FormField>
          <button type="submit" disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-6 py-3 text-lg font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-6 text-center text-base text-slate-500">
          New here? <Link to="/register" className="font-medium text-indigo-600">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
