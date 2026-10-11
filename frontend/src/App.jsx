import Navbar from './components/Navbar.jsx'
import AppRoutes from './routes/AppRoutes.jsx'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <AppRoutes />
      </main>
    </div>
  )
}
