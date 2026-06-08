import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateUserProfile, getCompany } from '../services/users'
import { db } from '../firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { requestPushPermission } from '../services/notifications'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import Spinner from '../components/ui/Spinner'
import toast from 'react-hot-toast'
import { Bell, User, Shield, CheckCircle, Copy, Check, AlertTriangle } from 'lucide-react'

export default function Settings() {
  const { currentUser, userProfile, refreshProfile } = useAuth()
  const [pushEnabled, setPushEnabled] = useState(Notification.permission === 'granted')
  const [copied, setCopied] = useState(false)
  const [company, setCompany] = useState(null)
  const [fixingRole, setFixingRole] = useState(false)

  useEffect(() => {
    if (userProfile?.companyId) getCompany(userProfile.companyId).then(setCompany)
  }, [userProfile?.companyId])

  // El usuario es dueño de la empresa pero tiene rol incorrecto
  const isOwnerWithWrongRole = company?.ownerUid === currentUser?.uid && userProfile?.role !== 'admin'

  const fixAdminRole = async () => {
    setFixingRole(true)
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      })
      await refreshProfile()
      toast.success('Rol de administrador restaurado. Recarga la página.')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Error al restaurar el rol')
    } finally { setFixingRole(false) }
  }

  const enablePush = async () => {
    const ok = await requestPushPermission(currentUser.uid)
    if (ok) { setPushEnabled(true); toast.success('Notificaciones activadas') }
    else toast.error('Revisa los permisos del navegador.')
  }

  const copyCode = () => {
    navigator.clipboard.writeText(userProfile?.companyId || '')
    setCopied(true)
    toast.success('Código copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <Header title="Ajustes" />
      <div className="px-4 lg:px-6 py-5 max-w-lg space-y-5">

        {/* Alerta de rol incorrecto */}
        {isOwnerWithWrongRole && (
          <div className="card p-4 border-amber-300 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Tu rol no se guardó correctamente</p>
                <p className="text-xs text-amber-700 mt-0.5 mb-3">
                  Eres el creador de esta empresa pero apareces como colaborador. Pulsa el botón para corregirlo.
                </p>
                <button onClick={fixAdminRole} disabled={fixingRole} className="btn-primary bg-amber-600 hover:bg-amber-700 text-sm">
                  {fixingRole ? <Spinner size="sm" /> : 'Restaurar rol de administrador'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Perfil */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={userProfile?.displayName} size="lg" />
            <div>
              <p className="text-base font-bold text-brand-text">{userProfile?.displayName}</p>
              <span className={`mt-1 badge text-xs ${userProfile?.role === 'admin' ? 'bg-brand-orange-light text-brand-orange border border-brand-orange/20' : 'bg-brand-bg-2 text-brand-text-muted border border-brand-border'}`}>
                {userProfile?.role === 'admin' ? <><Shield size={10} /> Administrador</> : <><User size={10} /> Colaborador</>}
              </span>
            </div>
          </div>
        </div>

        {/* Código de empresa */}
        {userProfile?.companyId && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <Shield size={16} className="text-brand-orange" />
              <h3 className="text-sm font-semibold text-brand-text">Código de empresa</h3>
            </div>
            <p className="text-xs text-brand-text-muted mb-2">
              Comparte este código con tu equipo para que puedan unirse al registrarse:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 px-3 py-2 bg-brand-bg-2 rounded-lg text-xs font-mono text-brand-text border border-brand-border break-all">
                {userProfile.companyId}
              </code>
              <button onClick={copyCode} className="btn-secondary px-3 flex-shrink-0">
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Notificaciones */}
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
            {pushEnabled
              ? <CheckCircle size={18} className="text-green-600" />
              : <button onClick={enablePush} className="btn-primary text-xs px-3 py-1.5">Activar</button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
