import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getTask, updateTask, addComment, subscribeComments, completeAndRecur, deleteTask } from '../services/tasks'
import { createNotification } from '../services/notifications'
import { useAuth } from '../contexts/AuthContext'
import { useUsers } from '../hooks/useUsers'
import Header from '../components/layout/Header'
import PriorityBadge from '../components/ui/PriorityBadge'
import StatusBadge from '../components/ui/StatusBadge'
import Avatar from '../components/ui/Avatar'
import Spinner from '../components/ui/Spinner'
import TaskModal from '../components/tasks/TaskModal'
import { STATUSES, RECURRENCES } from '../utils/constants'
import { formatDate, formatDateTime, isOverdue } from '../utils/dates'
import toast from 'react-hot-toast'
import { ArrowLeft, Edit, Trash2, RefreshCw, CheckCircle, Send, Calendar, User, Shield } from 'lucide-react'

export default function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const { users } = useUsers()
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    getTask(id).then((t) => { setTask(t); setLoading(false) })
  }, [id])

  useEffect(() => {
    const unsub = subscribeComments(id, setComments)
    return unsub
  }, [id])

  const assignee = users.find((u) => u.uid === task?.assignedTo)
  const verifier = users.find((u) => u.uid === task?.verifiedBy)
  const overdue = task && isOverdue(task.dueDate, task.status)
  const canEdit = userProfile?.role === 'admin' || task?.assignedTo === currentUser?.uid || task?.createdBy === currentUser?.uid
  const canVerify = task?.verifiedBy === currentUser?.uid && task?.status !== 'done'

  const handleStatusChange = async (newStatus) => {
    if (!task) return
    try {
      if (newStatus === 'done' && task.type === 'recurring') {
        await completeAndRecur(task, currentUser.uid)
        toast.success('Tarea completada. Se ha creado la siguiente recurrencia.')
      } else {
        await updateTask(task.id, { status: newStatus })
        toast.success('Estado actualizado')
      }
      if (newStatus === 'done' && task.verifiedBy) {
        await createNotification({
          recipientId: task.verifiedBy,
          taskId: task.id,
          taskTitle: task.title,
          type: 'completed',
          senderName: userProfile?.displayName,
        })
      }
      setTask((t) => ({ ...t, status: newStatus }))
    } catch { toast.error('Error al cambiar el estado') }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta tarea?')) return
    try {
      await deleteTask(task.id)
      toast.success('Tarea eliminada')
      navigate(-1)
    } catch { toast.error('Error al eliminar') }
  }

  const handleComment = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await addComment(id, comment, currentUser)
      setComment('')
    } catch { toast.error('Error al enviar el comentario') }
    finally { setSubmitting(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  if (!task) return (
    <div className="p-6 text-center text-brand-text-muted">
      Tarea no encontrada. <Link to="/tasks" className="text-brand-orange">Volver</Link>
    </div>
  )

  return (
    <div>
      <Header title="Detalle de tarea" />
      <div className="px-4 lg:px-6 py-5 max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn-ghost py-1.5 px-2">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1" />
          {canEdit && (
            <>
              <button onClick={() => setShowEdit(true)} className="btn-secondary text-xs px-3 py-1.5">
                <Edit size={13} /> Editar
              </button>
              {userProfile?.role === 'admin' && (
                <button onClick={handleDelete} className="btn-danger text-xs px-3 py-1.5">
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Task header */}
        <div className="card p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.type === 'recurring' && task.recurrence && (
              <span className="badge bg-brand-bg-2 text-brand-text-muted border border-brand-border">
                <RefreshCw size={11} /> Recurrente · {RECURRENCES[task.recurrence]?.label}
              </span>
            )}
            {overdue && <span className="badge bg-red-50 text-red-600 border border-red-200">⚠ Vencida</span>}
          </div>

          <h2 className={`text-xl font-bold text-brand-text ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
            {task.title}
          </h2>

          {task.description && (
            <p className="text-sm text-brand-text-muted leading-relaxed">{task.description}</p>
          )}

          {task.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-brand-bg-2 text-brand-text-muted text-xs rounded-lg border border-brand-border">{tag}</span>
              ))}
            </div>
          )}

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-border">
            {assignee && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-brand-text-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-brand-text-muted">Asignado a</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Avatar name={assignee.displayName} size="xs" />
                    <span className="text-xs font-medium text-brand-text">{assignee.displayName}</span>
                  </div>
                </div>
              </div>
            )}
            {verifier && (
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-brand-text-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-brand-text-muted">Verifica</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Avatar name={verifier.displayName} size="xs" />
                    <span className="text-xs font-medium text-brand-text">{verifier.displayName}</span>
                  </div>
                </div>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-brand-text-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-brand-text-muted">Fecha límite</p>
                  <p className={`text-xs font-medium mt-0.5 ${overdue ? 'text-red-500' : 'text-brand-text'}`}>
                    {formatDate(task.dueDate)}
                  </p>
                </div>
              </div>
            )}
            {task.startDate && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-brand-text-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-brand-text-muted">Fecha inicio</p>
                  <p className="text-xs font-medium text-brand-text mt-0.5">{formatDate(task.startDate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status actions */}
        {task.status !== 'done' && canEdit && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-3">Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUSES).filter(([k]) => k !== task.status).map(([k, v]) => (
                <button key={k} onClick={() => handleStatusChange(k)}
                  className={`badge ${v.bg} ${v.color} border cursor-pointer hover:opacity-80 transition-opacity py-1.5 px-3`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Verify */}
        {canVerify && task.status === 'done' && (
          <div className="card p-4 border-green-200 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">Esta tarea está lista para verificar</p>
                <p className="text-xs text-green-600 mt-0.5">Confirma que la tarea ha sido completada correctamente</p>
              </div>
              <button onClick={() => handleStatusChange('done')} className="btn-primary bg-green-600 hover:bg-green-700 text-sm">
                <CheckCircle size={15} /> Verificar
              </button>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card p-5">
          <p className="text-sm font-semibold text-brand-text mb-3">Observaciones y comentarios <span className="text-brand-text-muted font-normal">({comments.length})</span></p>
          <div className="space-y-3 mb-4">
            {comments.length === 0 ? (
              <p className="text-xs text-brand-text-muted py-4 text-center">Sin comentarios todavía</p>
            ) : comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar name={c.authorName} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-brand-text">{c.authorName}</span>
                    <span className="text-xs text-brand-text-light">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-brand-text mt-0.5 leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleComment} className="flex gap-2">
            <div className="flex items-start gap-2 flex-1">
              <Avatar name={userProfile?.displayName} size="xs" />
              <textarea rows={2} className="textarea-field flex-1 text-sm" placeholder="Añadir un comentario u observación..."
                value={comment} onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(e) } }} />
            </div>
            <button type="submit" disabled={submitting || !comment.trim()} className="btn-primary self-end">
              {submitting ? <Spinner size="sm" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </div>

      <TaskModal isOpen={showEdit} onClose={() => setShowEdit(false)} task={task} users={users} />
    </div>
  )
}
