import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-3xl font-semibold text-text-primary">404</h1>
      <p className="text-text-secondary">This page doesn't exist.</p>
      <Link to="/" className="text-brand-400 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
