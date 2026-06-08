import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { PRIORITIES, STATUSES, RECURRENCES } from '../../utils/constants'
import { createTask, updateTask } from '../../services/tasks'
import { createNotification } from '../../services/notifications'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from '../../contexts/TaskContext'
import { toInputDate } from '../../utils/dates'
import toast from 'react-hot-toast'
import Spinner from '../ui/Spinner'
import { ChevronDown } from 'lucide-react'

const EMPTY = {
  title: '', description: '', priority: 'important', status: 'not_started',
  type: 'single', recurrence: 'weekly', assignedTo: '', verifiedBy: '',
  dueDate: '', startDate: '', tags: '',
}

export default function TaskModal({ isOpen, onClose, task, users = [] }) {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const { currentUser, userProfile } = useAuth()
  const { companyId } = useTasks()
  const isEdit = !!task

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'important',
        status: task.status || 'not_started',
        type: task.type || 'single',
        recurrence: task.recurrence || 'weekly',
        assignedTo: task.assignedTo || '',
        verifiedBy: task.verifiedBy || '',
        dueDate: toInputDate(task.dueDate),
        startDate: toInputDate(task.startDate),
        tags: task.tags?.join(', ') || '',
      })
    } else {
      setForm({ ...EMPTY, assignedTo: currentUser?.uid || '', startDate: new Date().toISOString().split('T')[0] })
    }
  }, [task, isOpen, currentUser])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('El título es obligatorio')
    if (!form.assignedTo) return toast.error('Asigna la tarea a alguien')
    setLoading(true)
    try {
      const data = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        companyId,
        recurrence: form.type === 'recurring' ? form.recurrence : null,
      }
      if (!isEdit) {
        const taskId = await createTask(data, currentUser.uid)
        if (form.assignedTo && form.assignedTo !== currentUser.uid) {
          await createNotification({
            recipientId: form.assignedTo,
            taskId,
            taskTitle: form.title,
            type: 'assigned',
            senderName: userProfile?.displayName || currentUser.email,
          })
        }
        if (form.verifiedBy && form.verifiedBy !== currentUser.uid) {
          await createNotification({
            recipientId: form.verifiedBy,
            taskId,
            taskTitle: form.title,
            type: 'verify_requested',
            senderName: userProfile?.displayName || currentUser.email,
          })
        }
        toast.success('Tarea creada')
      } else {
        await updateTask(task.id, data)
        if (data.status === 'done' && task.status !== 'done' && form.verifiedBy) {
          await createNotification({
            recipientId: form.verifiedBy,
            taskId: task.id,
            taskTitle: form.title,
            type: 'completed',
            senderName: userProfile?.displayName || currentUser.email,
          })
        }
        toast.success('Tarea actualizada')
      }
      onClose()
    } catch (err) {
      toast.error('Error al guardar la tarea')
      console.error(err)
    } finally { setLoading(false) }
  }

  const assignedUser = users.find((u) => u.uid === form.assignedTo)
  const verifiedUser = users.find((u) => u.uid === form.verifiedBy)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar tarea' : 'Nueva tarea'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Title */}
        <div>
          <label className="label">Título *</label>
          <input type="text" required className="input-field" placeholder="¿Qué hay que hacer?"
            value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>

        {/* Description */}
        <div>
          <label className="label">Descripción</label>
          <textarea rows={3} className="textarea-field" placeholder="Descripción detallada de la tarea..."
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        {/* Priority + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Urgencia</label>
            <div className="relative">
              <select className="select-field pr-8" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Estado</label>
            <div className="relative">
              <select className="select-field pr-8" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Type + Recurrence */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo de tarea</label>
            <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-lg">
              {[['single', 'Única'], ['recurring', 'Recurrente']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('type', v)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${form.type === v ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {form.type === 'recurring' && (
            <div>
              <label className="label">Repetición</label>
              <div className="relative">
                <select className="select-field pr-8" value={form.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
                  {Object.entries(RECURRENCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Assigned + Verified */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Asignado a *</label>
            <div className="relative">
              <select className="select-field pr-8" value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Verifica</label>
            <div className="relative">
              <select className="select-field pr-8" value={form.verifiedBy} onChange={(e) => set('verifiedBy', e.target.value)}>
                <option value="">Ninguno</option>
                {users.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha inicio</label>
            <input type="date" className="input-field" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input type="date" className="input-field" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="label">Etiquetas <span className="normal-case font-normal">(separadas por coma)</span></label>
          <input type="text" className="input-field" placeholder="cocina, turno mañana, limpieza..."
            value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Spinner size="sm" /> : isEdit ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
