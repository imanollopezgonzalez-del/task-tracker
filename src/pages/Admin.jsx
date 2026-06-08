import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { updateUserProfile, getCompany } from '../services/users'
import { db } from '../firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import { useTasks } from '../contexts/TaskContext'
import { Copy, Check, ShieldCheck, User, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

export default function Admin() {
  const { userProfile } = useAuth()
  const { users } = useUsers()
  const { allTasks } = useTasks()
  const [company, setCompany] = useState(null)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // user to delete
  const [deleteStep, setDeleteStep] = useState(0) // 0=closed, 1=first confirm, 2=second confirm
  const [deleting, setDeleting] = useState(false)

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
    toast.success('Código copiado')
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleRole = async (uid, currentRole) => {
    if (uid === userProfile.uid) return toast.error('No puedes cambiar tu propio rol')
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    await updateUserProfile(uid, { role: newRole })
    toast.success(`Ahora es ${newRole === 'admin' ? 'Administrador' : 'Colaborador'}`)
  }

  const startDelete = (user) => { setDeleteTarget(user); setDeleteStep(1) }
  const cancelDelete = () => { setDeleteTarget(null); setDeleteStep(0) }

  const confirmDelete = async () => {
    if (deleteStep === 1) { setDeleteStep(2); return }
    // Step 2: actually delete
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', deleteTarget.uid))
      toast.success(`${deleteTarget.displayName} ha sido eliminado del equipo`)
      cancelDelete()
    } catch {
      toast.error('Error al eliminar el usuario')
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <Header title="Gestión del equipo" />
      <div className="px-4 lg:px-6 py-5 max-w-2xl space-y-5">

        {/* Company code */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-3">Empresa</h3>
          <p className="text-base font-bold text-brand-text mb-1">{company?.name || 'Mi Empresa'}</p>
          <p className="text-xs text-brand-text-muted mb-3">Código para que tu equipo se una al registrarse:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-brand-bg-2 rounded-lg text-xs text-brand-text font-mono border border-brand-border truncate">
              {userProfile?.companyId}
            </code>
            <button onClick={copyId} className="btn-secondary px-3 py-2 text-xs flex-shrink-0">
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Team members */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-3">
            Equipo <span className="text-brand-text-muted font-normal">({users.length})</span>
          </h3>
          <div className="space-y-2">
            {users.map((u) => {
              const assigned = allTasks.filter((t) => t.assignedTo === u.uid)
              const done = assigned.filter((t) => t.status === 'done').length
              const supervising = allTasks.filter((t) => t.verifiedBy === u.uid && t.assignedTo !== u.uid).length
              const isMe = u.uid === userProfile.uid
              return (
                <div key={u.uid} className="flex items-center gap-3 p-3 rounded-xl bg-brand-bg hover:bg-brand-bg-2 transition-colors">
                  <Avatar name={u.displayName || u.email} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-brand-text truncate">{u.displayName || 'Sin nombre'}</p>
                      {u.role === 'admin' && <ShieldCheck size={14} className="text-brand-orange flex-shrink-0" />}
                      {isMe && <span className="text-xs text-brand-text-light">(tú)</span>}
                    </div>
                    <p className="text-xs text-brand-text-light mt-0.5">
                      {done}/{assigned.length} completadas · {supervising} en supervisión
                    </p>
                  </div>
                  {!isMe && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleRole(u.uid, u.role)}
                        className="text-xs text-brand-text-muted hover:text-brand-orange font-medium transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-brand-bg-3">
                        {u.role === 'admin' ? <><User size={12} /> Quitar admin</> : <><ShieldCheck size={12} /> Admin</>}
                      </button>
                      <button onClick={() => startDelete(u)}
                        className="p-1.5 rounded-lg text-brand-text-light hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal isOpen={deleteStep > 0} onClose={cancelDelete}
        title={deleteStep === 1 ? 'Eliminar del equipo' : '⚠ Confirmar eliminación'} size="sm">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">{deleteTarget?.displayName}</p>
              {deleteStep === 1
                ? <p className="text-xs text-red-600 mt-0.5">¿Quieres eliminar a esta persona del equipo? Perderá acceso a la app.</p>
                : <p className="text-xs text-red-600 mt-0.5">Esta acción no se puede deshacer. ¿Confirmas la eliminación definitiva?</p>
              }
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={cancelDelete} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1 justify-center">
              {deleting ? <Spinner size="sm" /> : deleteStep === 1 ? 'Sí, eliminar' : 'Confirmar eliminación'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
