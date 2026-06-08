import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createCompany, joinCompany, buildUserEmail } from '../services/users'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckSquare, AlertCircle, Hash } from 'lucide-react'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useEmail, setUseEmail] = useState(false)

  // Campos nuevo sistema
  const [username, setUsername] = useState('')
  const [companyCode, setCompanyCode] = useState(() => localStorage.getItem('companyCode') || '')
  const [pin, setPin] = useState('')
  // Campos email clásico
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { login, register, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const clearError = () => setError('')

  const getErrorMsg = (code) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found': return 'Usuario, código de empresa o PIN incorrecto'
      case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos.'
      case 'auth/email-already-in-use': return 'Este nombre ya está registrado en esa empresa.'
      case 'auth/weak-password': return 'El PIN debe tener 4 dígitos.'
      case 'auth/network-request-failed': return 'Sin conexión. Revisa tu internet.'
      default: return 'Algo salió mal. Inténtalo de nuevo.'
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    clearError()
    setLoading(true)
    try {
      if (useEmail) {
        await login(email, password)
      } else {
        if (!username.trim()) { setError('Escribe tu nombre de usuario'); setLoading(false); return }
        if (!companyCode.trim()) { setError('Escribe el código de empresa'); setLoading(false); return }
        if (pin.length !== 4) { setError('El PIN debe ser de 4 dígitos'); setLoading(false); return }
        const internalEmail = buildUserEmail(username, companyCode)
        await login(internalEmail, 'TK' + pin)  // TK prefix: Firebase min 6 chars
        localStorage.setItem('companyCode', companyCode)
      }
      navigate('/')
    } catch (err) {
      setError(getErrorMsg(err.code))
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    clearError()
    if (!username.trim()) { setError('Escribe tu nombre'); return }
    if (!companyCode.trim()) { setError('Escribe el código de empresa'); return }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { setError('El PIN debe ser exactamente 4 dígitos numéricos'); return }
    setLoading(true)
    try {
      const internalEmail = buildUserEmail(username, companyCode)
      const user = await register(internalEmail, 'TK' + pin, username)  // TK prefix internally
      // companyCode puede ser el ID de empresa (si lo da el admin) o 'nuevo' para crear
      try {
        await joinCompany(user.uid, companyCode)
      } catch {
        // Si no existe esa empresa, crearla (primer usuario = admin)
        await createCompany('Mi Empresa', user.uid)
      }
      localStorage.setItem('companyCode', companyCode)
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
              <button key={t} type="button" onClick={() => { setTab(t); clearError() }}
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

          {tab === 'login' && !useEmail ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Nombre de usuario</label>
                <input type="text" autoComplete="username" className="input-field" placeholder="Ej: Imanol"
                  value={username} onChange={(e) => { clearError(); setUsername(e.target.value) }} />
              </div>
              <div>
                <label className="label">Código de empresa</label>
                <input type="text" className="input-field" placeholder="Código que te dio el administrador"
                  value={companyCode} onChange={(e) => { clearError(); setCompanyCode(e.target.value) }} />
              </div>
              <div>
                <label className="label">PIN <span className="normal-case font-normal text-brand-text-light">(4 dígitos)</span></label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} inputMode="numeric" maxLength={4}
                    className="input-field pr-10 tracking-widest text-lg" placeholder="••••"
                    value={pin} onChange={(e) => { clearError(); setPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Entrar'}
              </button>
              <button type="button" onClick={() => { setUseEmail(true); clearError() }}
                className="w-full text-center text-xs text-brand-text-light hover:text-brand-text-muted py-1">
                Acceso con email (administrador)
              </button>
            </form>
          ) : tab === 'login' && useEmail ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" required autoComplete="email" className="input-field" placeholder="tu@email.com"
                  value={email} onChange={(e) => { clearError(); setEmail(e.target.value) }} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password" className="input-field pr-10"
                    value={password} onChange={(e) => { clearError(); setPassword(e.target.value) }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Entrar'}
              </button>
              <button type="button" onClick={() => { setUseEmail(false); clearError() }}
                className="w-full text-center text-xs text-brand-text-light hover:text-brand-text-muted py-1">
                ← Volver a acceso con PIN
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Tu nombre</label>
                <input type="text" required autoComplete="name" className="input-field" placeholder="Ej: Imanol"
                  value={username} onChange={(e) => { clearError(); setUsername(e.target.value) }} />
              </div>
              <div>
                <label className="label">Código de empresa</label>
                <input type="text" className="input-field" placeholder="Te lo da el administrador"
                  value={companyCode} onChange={(e) => { clearError(); setCompanyCode(e.target.value) }} />
                <p className="text-xs text-brand-text-light mt-1">Si eres el primero, déjalo vacío y se creará una empresa nueva.</p>
              </div>
              <div>
                <label className="label">PIN <span className="normal-case font-normal text-brand-text-light">(4 dígitos)</span></label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
                  <input type={showPwd ? 'text' : 'password'} inputMode="numeric" maxLength={4}
                    className="input-field pl-8 pr-10 tracking-widest text-lg" placeholder="••••"
                    value={pin} onChange={(e) => { clearError(); setPin(e.target.value.replace(/\D/g, '').slice(0, 4)) }} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
