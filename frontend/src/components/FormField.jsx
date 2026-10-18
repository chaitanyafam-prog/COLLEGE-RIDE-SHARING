export const inputClass =
  'w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-base text-slate-900'

export default function FormField({ label, error, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  )
}
