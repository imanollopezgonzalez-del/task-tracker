import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createCompany, joinCompany } from '../services/users'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckSquare } from 'lucide-react'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [form, setForm] = useState({ email: '', password: '', displayName: '' })
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      const msg = err.code
      if (msg === 'auth/invalid-credential' || msg === 'auth/wrong-password' || msg === 'auth/user-not-found') {
        toast.error('Email o contraseña incorrectos')
      } else if (msg === 'auth/too-many-requests') {
        toast.error('Demasiados intentos. Espera unos minutos.')
      } else {
        toast.error('Error al iniciar sesión. Revisa tu conexión.')
      }
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.displayName.trim()) return toast.error('Escribe tu nombre')
    if (!form.email.trim()) return toast.error('Escribe tu email')
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    setLoading(true)
    try {
      const user = await register(form.email, form.password, form.displayName)
      if (inviteCode.trim()) {
        // Join existing company with invite code
        await joinCompany(user.uid, inviteCode.trim())
      } else {
        // Create a default company automatically
        await createCompany('Mi Empresa', user.uid)
      }
      navigate('/')
      toast.success(`¡Bienvenido, ${form.displayName}!`)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Este email ya está registrado. Prueba a iniciar sesión.')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('El formato del email no es válido.')
      } else if (err.code === 'auth/weak-password') {
        toast.error('La contraseña es demasiado débil.')
      } else {
        toast.error(err.message || 'Error al crear la cuenta.')
      }
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
          <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-lg mb-6">
            {['login', 'register'].map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
                {t === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" required autoComplete="email" className="input-field" placeholder="tu@empresa.com"
                  value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required autoComplete="current-password" className="input-field pr-10" placeholder="••••••••"
                    value={form.password} onChange={(e) => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Tu nombre</label>
                <input type="text" required autoComplete="name" className="input-field" placeholder="Ej: Juan García"
                  value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" required autoComplete="email" className="input-field" placeholder="tu@empresa.com"
                  value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required minLength={6} autoComplete="new-password"
                    className="input-field pr-10" placeholder="Mínimo 6 caracteres"
                    value={form.password} onChange={(e) => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">
                  Código de invitación <span className="normal-case font-normal text-brand-text-light">(opcional)</span>
                </label>
                <input type="text" className="input-field" placeholder="Déjalo vacío si eres el primero en registrarte"
                  value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                <p className="text-xs text-brand-text-light mt-1">
                  Si alguien ya creó la cuenta de empresa, pídele su código de empresa.
                </p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Spinner size="sm" /> : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-brand-text-muted mt-4">
          Doble control de tareas · Seguimiento de equipos
        </p>
      </div>
    </div>
  )
}
