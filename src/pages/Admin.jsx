import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { updateUserProfile, getCompany } from '../services/users'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import { useTasks } from '../contexts/TaskContext'
import { Copy, Check, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

export default function Admin() {
  const { userProfile } = useAuth()
  const { users } = useUsers()
  const { allTasks } = useTasks()
  const [company, setCompany] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (userProfile?.companyId) getCompany(userProfile.companyId).then(setCompany)
  }, [userProfile])

  if (userProfile?.role !== 'admin') return (
    <div className="p-6 text-center">
      <p className="text-brand-text-muted text-sm">Solo los administradores pueden acceder a esta sección.</p>
    </div>
  )

  const copyId = () => {
    navigator.clipboard.writeText(userProfile.companyId)
    setCopied(true)
    toast.success('ID copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleRole = async (uid, currentRole) => {
    if (uid === userProfile.uid) return toast.error('No puedes cambiar tu propio rol')
    const newRole = currentRole === 'admin' ? 'employee' : 'admin'
    await updateUserProfile(uid, { role: newRole })
    toast.success(`Rol actualizado a ${newRole === 'admin' ? 'Administrador' : 'Empleado'}`)
  }

  return (
    <div>
      <Header title="Gestión del equipo" />
      <div className="px-4 lg:px-6 py-5 max-w-2xl space-y-5">
        {/* Company info */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-3">Empresa</h3>
          <p className="text-base font-bold text-brand-text mb-1">{company?.name || 'Sin nombre'}</p>
          <p className="text-xs text-brand-text-muted mb-3">Comparte este ID para que tus empleados puedan unirse al crear su cuenta:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-brand-bg-2 rounded-lg text-xs text-brand-text font-mono border border-brand-border truncate">
              {userProfile?.companyId}
            </code>
            <button onClick={copyId} className="btn-secondary px-3 py-2 text-xs flex-shrink-0">
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Users */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-3">Miembros del equipo <span className="text-brand-text-muted font-normal">({users.length})</span></h3>
          <div className="space-y-2">
            {users.map((u) => {
              const userTasks = allTasks.filter((t) => t.assignedTo === u.uid)
              const done = userTasks.filter((t) => t.status === 'done').length
              return (
                <div key={u.uid} className="flex items-center gap-3 p-3 rounded-xl bg-brand-bg hover:bg-brand-bg-2 transition-colors">
                  <Avatar name={u.displayName || u.email} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-brand-text truncate">{u.displayName || 'Sin nombre'}</p>
                      {u.role === 'admin' && <ShieldCheck size={14} className="text-brand-orange flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-brand-text-muted truncate">{u.email}</p>
                    <p className="text-xs text-brand-text-light mt-0.5">{done}/{userTasks.length} tareas completadas</p>
                  </div>
                  {u.uid !== userProfile.uid && (
                    <button onClick={() => toggleRole(u.uid, u.role)}
                      className="text-xs text-brand-text-muted hover:text-brand-orange font-medium transition-colors flex-shrink-0 flex items-center gap-1">
                      {u.role === 'admin' ? <><User size={12} /> Hacer empleado</> : <><ShieldCheck size={12} /> Hacer admin</>}
                    </button>
                  )}
                  {u.uid === userProfile.uid && (
                    <span className="text-xs text-brand-text-light">(tú)</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
