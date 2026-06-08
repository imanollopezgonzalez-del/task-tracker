import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateUserProfile, buildUserEmail } from '../services/users'
import { updateProfile, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { auth } from '../firebase'
import { requestPushPermission } from '../services/notifications'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Bell, User, Shield, CheckCircle, Key, Copy, Check } from 'lucide-react'

export default function Settings() {
  const { currentUser, userProfile, refreshProfile } = useAuth()
  const [name, setName] = useState(userProfile?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted')
  const [copied, setCopied] = useState(false)

  // PIN migration
  const [pinUsername, setPinUsername] = useState(userProfile?.displayName || '')
  const [newPin, setNewPin] = useState('')
  const [currentPwd, setCurrentPwd] = useState('')
  const [savingPin, setSavingPin] = useState(false)

  const saveName = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateProfile(auth.currentUser, { displayName: name })
      await updateUserProfile(currentUser.uid, { displayName: name })
      await refreshProfile()
      toast.success('Nombre actualizado')
    } catch { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  const migrateToPIN = async (e) => {
    e.preventDefault()
    if (!pinUsername.trim()) return toast.error('Escribe tu nombre de usuario')
    if (!/^\d{4}$/.test(newPin)) return toast.error('El PIN debe ser exactamente 4 dígitos')
    if (!currentPwd.trim()) return toast.error('Escribe tu contraseña actual para confirmar')
    if (!userProfile?.companyId) return toast.error('No tienes empresa asignada')
    setSavingPin(true)
    try {
      // Re-autenticar con credenciales actuales
      const credential = EmailAuthProvider.credential(currentUser.email, currentPwd)
      await reauthenticateWithCredential(currentUser, credential)
      // Cambiar email y contraseña al nuevo formato PIN
      const newEmail = buildUserEmail(pinUsername)
      await updateEmail(currentUser, newEmail)
      await updatePassword(currentUser, newPin)
      await updateProfile(currentUser, { displayName: pinUsername })
      await updateUserProfile(currentUser.uid, { displayName: pinUsername })
      await refreshProfile()
      localStorage.setItem('companyCode', userProfile.companyId)
      toast.success(`¡Listo! Entra con usuario "${pinUsername}" y tu PIN`)
      setCurrentPwd('')
      setNewPin('')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Contraseña actual incorrecta')
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('Ese nombre de usuario ya está en uso en esta empresa')
      } else {
        toast.error('Error al migrar: ' + (err.message || err.code))
      }
    } finally { setSavingPin(false) }
  }

  const copyCompanyId = () => {
    navigator.clipboard.writeText(userProfile?.companyId || '')
    setCopied(true)
    toast.success('Código copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  const enablePush = async () => {
    const ok = await requestPushPermission(currentUser.uid)
    if (ok) { setPushEnabled(true); toast.success('Notificaciones push activadas') }
    else toast.error('No se pudo activar. Revisa los permisos del navegador.')
  }

  const isUsingPinLogin = currentUser?.email?.endsWith('.tasks')

  return (
    <div>
      <Header title="Ajustes" />
      <div className="px-4 lg:px-6 py-5 max-w-lg space-y-5">

        {/* Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <User size={16} className="text-brand-orange" />
            <h3 className="text-sm font-semibold text-brand-text">Perfil</h3>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={userProfile?.displayName} size="lg" />
            <div>
              <p className="text-sm font-bold text-brand-text">{userProfile?.displayName}</p>
              <p className="text-xs text-brand-text-muted">{isUsingPinLogin ? 'Acceso con PIN ✓' : currentUser?.email}</p>
              <span className={`mt-1 badge text-xs ${userProfile?.role === 'admin' ? 'bg-brand-orange-light text-brand-orange border border-brand-orange/20' : 'bg-brand-bg-2 text-brand-text-muted border border-brand-border'}`}>
                {userProfile?.role === 'admin' ? <><Shield size={10} /> Administrador</> : <><User size={10} /> Empleado</>}
              </span>
            </div>
          </div>
          <form onSubmit={saveName} className="space-y-3">
            <div>
              <label className="label">Nombre para mostrar</label>
              <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" disabled={saving || name === userProfile?.displayName} className="btn-primary">
              {saving ? <Spinner size="sm" /> : 'Guardar nombre'}
            </button>
          </form>
        </div>

        {/* PIN Migration — solo si aún usa email clásico */}
        {!isUsingPinLogin && (
          <div className="card p-5 border-brand-orange/30">
            <div className="flex items-center gap-3 mb-1">
              <Key size={16} className="text-brand-orange" />
              <h3 className="text-sm font-semibold text-brand-text">Cambiar a acceso con PIN</h3>
            </div>
            <p className="text-xs text-brand-text-muted mb-4">
              Configura tu nombre de usuario y PIN de 4 dígitos para entrar sin email.
            </p>
            <form onSubmit={migrateToPIN} className="space-y-3">
              <div>
                <label className="label">Nombre de usuario</label>
                <input type="text" className="input-field" placeholder="Ej: Imanol"
                  value={pinUsername} onChange={(e) => setPinUsername(e.target.value)} />
              </div>
              <div>
                <label className="label">Nuevo PIN <span className="normal-case font-normal text-brand-text-light">(6 dígitos)</span></label>
                <input type="password" inputMode="numeric" maxLength={6} className="input-field tracking-widest text-lg text-center"
                  placeholder="······" value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div>
                <label className="label">Contraseña actual <span className="normal-case font-normal text-brand-text-light">(para confirmar)</span></label>
                <input type="password" className="input-field" placeholder="Tu contraseña de email actual"
                  value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
              </div>
              <button type="submit" disabled={savingPin} className="btn-primary w-full justify-center">
                {savingPin ? <Spinner size="sm" /> : 'Activar acceso con PIN'}
              </button>
            </form>
          </div>
        )}

        {/* Company code */}
        {userProfile?.companyId && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <Shield size={16} className="text-brand-orange" />
              <h3 className="text-sm font-semibold text-brand-text">Código de empresa</h3>
            </div>
            <p className="text-xs text-brand-text-muted mb-2">
              Comparte este código con tus empleados para que puedan registrarse:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-brand-bg-2 rounded-lg text-xs font-mono text-brand-text border border-brand-border break-all">
                {userProfile.companyId}
              </code>
              <button onClick={copyCompanyId} className="btn-secondary px-3 py-2 flex-shrink-0">
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={16} className="text-brand-orange" />
            <h3 className="text-sm font-semibold text-brand-text">Notificaciones</h3>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-brand-border">
            <div>
              <p className="text-sm font-medium text-brand-text">Notificaciones en pantalla</p>
              <p className="text-xs text-brand-text-muted">Activas dentro de la app</p>
            </div>
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-brand-text">Notificaciones push</p>
              <p className="text-xs text-brand-text-muted">Avisos con la app cerrada</p>
            </div>
            {pushEnabled ? (
              <CheckCircle size={18} className="text-green-600" />
            ) : (
              <button onClick={enablePush} className="btn-primary text-xs px-3 py-1.5">Activar</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
