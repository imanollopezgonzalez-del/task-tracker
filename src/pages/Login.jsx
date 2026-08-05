import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AlertCircle } from 'lucide-react'
import Spinner from '../components/ui/Spinner'

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.11C3.25 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 014.9 12c0-.79.14-1.56.37-2.28V6.61H1.27A11.98 11.98 0 000 12c0 1.94.46 3.77 1.27 5.39l4-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  )
}

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const getErrorMsg = (code, message) => {
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request': return ''
      case 'auth/network-request-failed': return 'Sin conexión. Revisa tu internet.'
      case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos.'
      case 'auth/google-not-authorized': return message
      default: return message || 'Algo salió mal. Inténtalo de nuevo.'
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      const msg = getErrorMsg(err.code, err.message)
      if (msg) setError(msg)
    } finally { setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-orange rounded-2xl mb-4 shadow-lg shadow-brand-orange/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7"><path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-brand-text">Gestión de Tareas</h1>
          <p className="text-sm text-brand-text-muted mt-1">Pollo Cocido & Pastas Pariggi</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-brand-border bg-white hover:bg-brand-bg-2 transition-colors font-medium text-sm text-brand-text disabled:opacity-60"
          >
            {googleLoading ? <Spinner size="sm" /> : <><GoogleIcon /> Continuar con Google</>}
          </button>
        </div>
        <p className="text-center text-xs text-brand-text-muted mt-4">Doble control · Seguimiento de equipos</p>
      </div>
    </div>
  )
}
