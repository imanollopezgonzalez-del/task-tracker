import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUsers } from '../hooks/useUsers'
import {
  updateUserProfile, getCompany,
  subscribeUsuariosAutorizados, addUsuarioAutorizado, removeUsuarioAutorizado,
} from '../services/users'
import { db } from '../firebase'
import { doc, deleteDoc } from 'firebase/firestore'
import Header from '../components/layout/Header'
import Avatar from '../components/ui/Avatar'
import { useTasks } from '../contexts/TaskContext'
import { Copy, Check, ShieldCheck, User, Trash2, AlertTriangle, Mail, Plus } from 'lucide-react'
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
  const [autorizados, setAutorizados] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRole, setNuevoRole] = useState('member')
  const [nuevoCrm, setNuevoCrm] = useState(false)
  const [savingAutorizado, setSavingAutorizado] = useState(false)

  useEffect(() => {
    if (userProfile?.companyId) getCompany(userProfile.companyId).then(setCompany)
  }, [userProfile])

  useEffect(() => {
    if (!userProfile?.companyId) return
    return subscribeUsuariosAutorizados(userProfile.companyId, setAutorizados)
  }, [userProfile?.companyId])

  const handleAddAutorizado = async (e) => {
    e.preventDefault()
    const email = nuevoEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return toast.error('Escribí un email válido')
    setSavingAutorizado(true)
    try {
      await addUsuarioAutorizado(email, { companyId: userProfile.companyId, role: nuevoRole, crmAccess: nuevoCrm })
      toast.success(`${email} ya puede entrar con Google`)
      setNuevoEmail(''); setNuevoRole('member'); setNuevoCrm(false)
    } catch {
      toast.error('Error al autorizar el email')
    } finally { setSavingAutorizado(false) }
  }

  const handleRemoveAutorizado = async (email) => {
    if (!window.confirm(`¿Quitar el acceso de ${email}?`)) return
    await removeUsuarioAutorizado(email)
    toast.success('Acceso revocado')
  }

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
    } catch (err) {
      console.error('Error eliminando usuario:', err)
      toast.error(err?.code === 'permission-denied'
        ? 'Sin permiso: actualiza las reglas de Firestore'
        : `Error: ${err?.message || 'No se pudo eliminar'}`)
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

        {/* Acceso con Google */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-1">Acceso con Google</h3>
          <p className="text-xs text-brand-text-muted mb-3">
            Autorizá un email de Google para que esa persona pueda entrar (sin usuario ni PIN). Si ya es parte del equipo, se lo asigna directo a tu empresa la primera vez que inicie sesión.
          </p>

          <form onSubmit={handleAddAutorizado} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="email" required placeholder="nombre@gmail.com"
              className="input-field flex-1 text-sm"
              value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)}
            />
            <select value={nuevoRole} onChange={(e) => setNuevoRole(e.target.value)}
              className="input-field text-sm sm:w-32">
              <option value="member">Colaborador</option>
              <option value="admin">Admin</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-brand-text-muted whitespace-nowrap px-1">
              <input type="checkbox" checked={nuevoCrm} onChange={(e) => setNuevoCrm(e.target.checked)} />
              Acceso CRM
            </label>
            <button type="submit" disabled={savingAutorizado} className="btn-primary text-sm px-3 flex-shrink-0">
              {savingAutorizado ? <Spinner size="sm" /> : <><Plus size={14} /> Autorizar</>}
            </button>
          </form>

          {autorizados.length > 0 && (
            <div className="space-y-1.5">
              {autorizados.map((a) => (
                <div key={a.email} className="flex items-center gap-2 p-2 rounded-lg bg-brand-bg text-sm">
                  <Mail size={13} className="text-brand-text-light flex-shrink-0" />
                  <span className="flex-1 truncate text-brand-text">{a.email}</span>
                  <span className="text-xs text-brand-text-muted">{a.role === 'admin' ? 'Admin' : 'Colaborador'}{a.crmAccess ? ' · CRM' : ''}</span>
                  <button onClick={() => handleRemoveAutorizado(a.email)} className="p-1 rounded text-brand-text-light hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
