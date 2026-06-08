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
  const [form, setForm] = useState({ email: '', password: '', displayName: '', companyMode: 'create', companyName: '', companyId: '' })
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
      toast.error(err.message.includes('invalid-credential') ? 'Email o contraseña incorrectos' : 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.displayName.trim()) return toast.error('Escribe tu nombre')
    if (form.companyMode === 'create' && !form.companyName.trim()) return toast.error('Escribe el nombre de tu empresa')
    if (form.companyMode === 'join' && !form.companyId.trim()) return toast.error('Introduce el ID de empresa')
    setLoading(true)
    try {
      const user = await register(form.email, form.password, form.displayName)
      if (form.companyMode === 'create') {
        await createCompany(form.companyName, user.uid)
      } else {
        await joinCompany(user.uid, form.companyId)
      }
      navigate('/')
      toast.success(`Bienvenido, ${form.displayName}!`)
    } catch (err) {
      toast.error(err.message.includes('email-already-in-use') ? 'Este email ya está registrado' : err.message)
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
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
                {t === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" required className="input-field" placeholder="tu@empresa.com"
                  value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required className="input-field pr-10" placeholder="••••••••"
                    value={form.password} onChange={(e) => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Spinner size="sm" /> : 'Iniciar sesión'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Tu nombre</label>
                <input type="text" required className="input-field" placeholder="Juan García"
                  value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" required className="input-field" placeholder="tu@empresa.com"
                  value={form.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required minLength={6} className="input-field pr-10" placeholder="Mínimo 6 caracteres"
                    value={form.password} onChange={(e) => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Empresa</label>
                <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-lg mb-3">
                  {[['create', 'Crear empresa'], ['join', 'Unirse a empresa']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => set('companyMode', v)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${form.companyMode === v ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {form.companyMode === 'create' ? (
                  <input type="text" className="input-field" placeholder="Nombre de tu empresa"
                    value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
                ) : (
                  <input type="text" className="input-field" placeholder="ID de empresa (pide al admin)"
                    value={form.companyId} onChange={(e) => set('companyId', e.target.value)} />
                )}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
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
