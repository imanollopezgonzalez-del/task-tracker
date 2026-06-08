import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createCompany, joinCompany, buildUserEmail } from '../services/users'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckSquare, AlertCircle } from 'lucide-react'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [companyCode, setCompanyCode] = useState('')

  const { login, register, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const clear = () => setError('')

  const getErrorMsg = (code) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found': return 'Usuario o PIN incorrecto'
      case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos.'
      case 'auth/email-already-in-use': return 'Ese nombre de usuario ya existe. Elige otro.'
      case 'auth/network-request-failed': return 'Sin conexión. Revisa tu internet.'
      default: return 'Algo salió mal. Inténtalo de nuevo.'
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    clear()
    if (!username.trim()) { setError('Escribe tu nombre de usuario'); return }
    if (pin.length !== 6) { setError('El PIN debe tener 6 dígitos'); return }
    setLoading(true)
    try {
      await login(buildUserEmail(username), pin)
      navigate('/')
    } catch (err) {
      setError(getErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    clear()
    if (!username.trim()) { setError('Escribe tu nombre'); return }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) { setError('El PIN debe ser 6 dígitos numéricos'); return }
    setLoading(true)
    try {
      const user = await register(buildUserEmail(username), pin, username)
      if (companyCode.trim()) {
        await joinCompany(user.uid, companyCode.trim())
      } else {
        await createCompany('Mi Empresa', user.uid)
      }
      await refreshProfile()
      navigate('/')
      toast.success(`¡Bienvenido, ${username}!`)
    } catch (err) {
      setError(getErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-orange rounded-2xl mb-4 shadow-lg shadow-brand-orange/20">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text">Gestión de Tareas</h1>
          <p className="text-sm text-brand-text-muted mt-1">Pollo Cocido & Pastas Pariggi</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-lg mb-5">
            {['login', 'register'].map((t) => (
              <button key={t} type="button" onClick={() => { setTab(t); clear(); setPin('') }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
                {t === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5 mb-4">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Nombre de usuario</label>
                <input type="text" autoComplete="username" className="input-field" placeholder="Ej: Imanol"
                  value={username} onChange={(e) => { clear(); setUsername(e.target.value) }} />
              </div>
              <div>
                <label className="label">PIN <span className="normal-case font-normal text-brand-text-light">(6 dígitos)</span></label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field pr-10 tracking-widest text-xl text-center"
                    placeholder="······"
                    value={pin}
                    onChange={(e) => { clear(); setPin(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Tu nombre</label>
                <input type="text" required autoComplete="name" className="input-field" placeholder="Ej: Ivan"
                  value={username} onChange={(e) => { clear(); setUsername(e.target.value) }} />
              </div>
              <div>
                <label className="label">PIN <span className="normal-case font-normal text-brand-text-light">(6 dígitos)</span></label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field pr-10 tracking-widest text-xl text-center"
                    placeholder="······"
                    value={pin}
                    onChange={(e) => { clear(); setPin(e.target.value.replace(/\D/g, '').slice(0, 6)) }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">
                  Código de empresa <span className="normal-case font-normal text-brand-text-light">(te lo da el admin)</span>
                </label>
                <input type="text" className="input-field" placeholder="Déjalo vacío si eres el primero"
                  value={companyCode} onChange={(e) => { clear(); setCompanyCode(e.target.value) }} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-brand-text-muted mt-4">Doble control · Seguimiento de equipos</p>
      </div>
    </div>
  )
}
