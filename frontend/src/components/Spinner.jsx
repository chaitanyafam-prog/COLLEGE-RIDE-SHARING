export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-slate-500" role="status" aria-live="polite">
      <span className="loading-rule" aria-hidden="true" />
      <span className="text-sm italic">{label}</span>
    </div>
  )
}
