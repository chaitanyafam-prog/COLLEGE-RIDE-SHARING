import Navbar from './components/Navbar.jsx'
import AppRoutes from './routes/AppRoutes.jsx'

export default function App() {
  return (
    <div className="min-h-screen px-4 py-5 sm:px-6">
      <div className="app-container space-y-4">
        <Navbar />
        <main className="panel">
          <AppRoutes />
        </main>
      </div>
    </div>
  )
}
