import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { PRIORITIES, STATUSES } from '../../utils/constants'
import { createTask, updateTask, addComment } from '../../services/tasks'
import { createNotification } from '../../services/notifications'
import { useAuth } from '../../contexts/AuthContext'
import { useTasks } from '../../contexts/TaskContext'
import { toInputDate } from '../../utils/dates'
import RecurrencePicker from './RecurrencePicker'
import toast from 'react-hot-toast'
import Spinner from '../ui/Spinner'
import { ChevronDown } from 'lucide-react'

const RECURRENCE_DEFAULTS = {
  daily: { every: 1 },
  weekly: { days: [1, 2, 3, 4, 5] },
  monthly: { dayOfMonth: new Date().getDate() },
  annual: {},
}

const EMPTY = {
  title: '', description: '', priority: 'important', status: 'not_started',
  type: 'single', recurrence: 'weekly', recurrenceConfig: { days: [1, 2, 3, 4, 5] },
  assignedTo: '', verifiedBy: '', dueDate: '', startDate: '', observation: '',
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
        recurrenceConfig: task.recurrenceConfig || {},
        assignedTo: task.assignedTo || '',
        verifiedBy: task.verifiedBy || '',
        dueDate: toInputDate(task.dueDate),
        startDate: toInputDate(task.startDate),
        observation: '',
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
      const { observation, ...rest } = form
      const data = {
        ...rest,
        companyId,
        recurrence: form.type === 'recurring' ? form.recurrence : null,
        recurrenceConfig: form.type === 'recurring' ? (form.recurrenceConfig || {}) : null,
      }
      if (!isEdit) {
        const taskId = await createTask(data, currentUser.uid)
        // Guardar observación inicial como primer comentario
        if (observation.trim()) {
          await addComment(taskId, observation.trim(), currentUser)
        }
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
        if (observation.trim()) {
          await addComment(task.id, observation.trim(), currentUser)
        }
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar tarea' : 'Nueva tarea'} size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        <div>
          <label className="label">Título *</label>
          <input type="text" required className="input-field" placeholder="¿Qué hay que hacer?"
            value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea rows={2} className="textarea-field" placeholder="Descripción detallada de la tarea..."
            value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

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

        {/* Tipo de tarea */}
        <div>
          <label className="label">Tipo de tarea</label>
          <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-lg mb-3">
            {[['single', 'Tarea única'], ['recurring', 'Tarea recurrente']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setForm((f) => ({
                ...f, type: v,
                recurrenceConfig: v === 'recurring' ? (Object.keys(f.recurrenceConfig || {}).length ? f.recurrenceConfig : (RECURRENCE_DEFAULTS[f.recurrence] || {})) : f.recurrenceConfig,
              }))}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${form.type === v ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted'}`}>
                {l}
              </button>
            ))}
          </div>
          {form.type === 'recurring' && (
            <RecurrencePicker
              recurrence={form.recurrence}
              config={form.recurrenceConfig}
              onChange={(v) => setForm((f) => ({ ...f, recurrence: v, recurrenceConfig: RECURRENCE_DEFAULTS[v] || {} }))}
              onConfigChange={(v) => set('recurrenceConfig', v)}
            />
          )}
        </div>

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

        <div>
          <label className="label">
            Observación inicial <span className="normal-case font-normal text-brand-text-light">(opcional)</span>
          </label>
          <textarea rows={2} className="textarea-field"
            placeholder="Añade una nota o indicación para quien realiza la tarea..."
            value={form.observation} onChange={(e) => set('observation', e.target.value)} />
          <p className="text-xs text-brand-text-light mt-1">Se guardará como primer comentario en la tarea.</p>
        </div>

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
