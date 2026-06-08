import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateUserProfile } from '../services/users'
import { updateProfile } from 'firebase/auth'
import { auth } from '../firebase'
import { requestPushPermission } from '../services/notifications'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Bell, User, Shield, CheckCircle } from 'lucide-react'

export default function Settings() {
  const { currentUser, userProfile, refreshProfile } = useAuth()
  const [name, setName] = useState(userProfile?.displayName || '')
  const [saving, setSaving] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted')

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

  const enablePush = async () => {
    const ok = await requestPushPermission(currentUser.uid)
    if (ok) { setPushEnabled(true); toast.success('Notificaciones push activadas') }
    else toast.error('No se pudo activar las notificaciones. Revisa los permisos del navegador.')
  }

  return (
    <div>
      <Header title="Ajustes" />
      <div className="px-4 lg:px-6 py-5 max-w-lg space-y-5">
        {/* Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-5">
            <User size={16} className="text-brand-orange" />
            <h3 className="text-sm font-semibold text-brand-text">Perfil</h3>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={userProfile?.displayName} size="lg" />
            <div>
              <p className="text-sm font-bold text-brand-text">{userProfile?.displayName}</p>
              <p className="text-xs text-brand-text-muted">{currentUser?.email}</p>
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
              <p className="text-xs text-brand-text-muted">Avisos incluso con la app cerrada</p>
            </div>
            {pushEnabled ? (
              <CheckCircle size={18} className="text-green-600" />
            ) : (
              <button onClick={enablePush} className="btn-primary text-xs px-3 py-1.5">Activar</button>
            )}
          </div>
        </div>

        {/* Company ID */}
        {userProfile?.companyId && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <Shield size={16} className="text-brand-orange" />
              <h3 className="text-sm font-semibold text-brand-text">Tu empresa</h3>
            </div>
            <p className="text-xs text-brand-text-muted mb-2">ID de empresa (para compartir con nuevos miembros):</p>
            <code className="block px-3 py-2 bg-brand-bg-2 rounded-lg text-xs font-mono text-brand-text border border-brand-border break-all">
              {userProfile.companyId}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}
