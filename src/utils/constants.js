export const PRIORITIES = {
  urgent: { label: 'Urgente', color: 'text-priority-urgent', bg: 'bg-priority-urgent-bg', border: 'border-priority-urgent-border', dot: 'bg-priority-urgent', order: 1 },
  important: { label: 'Importante', color: 'text-priority-important', bg: 'bg-priority-important-bg', border: 'border-priority-important-border', dot: 'bg-priority-important', order: 2 },
  low: { label: 'No Urgente', color: 'text-priority-low', bg: 'bg-priority-low-bg', border: 'border-priority-low-border', dot: 'bg-priority-low', order: 3 },
}

export const STATUSES = {
  not_started: { label: 'Sin comenzar', color: 'text-task-not-started', bg: 'bg-task-not-started-bg', dot: 'bg-task-not-started', next: 'in_progress' },
  in_progress: { label: 'En curso', color: 'text-task-in-progress', bg: 'bg-task-in-progress-bg', dot: 'bg-task-in-progress', next: 'pending_response' },
  pending_response: { label: 'Pendiente Revisión', color: 'text-task-pending-response', bg: 'bg-task-pending-response-bg', dot: 'bg-task-pending-response', next: 'pending_adjustments' },
  pending_adjustments: { label: 'Pend. Ajustes', color: 'text-task-pending-adjustments', bg: 'bg-task-pending-adjustments-bg', dot: 'bg-task-pending-adjustments', next: 'done' },
  done: { label: 'Finalizado', color: 'text-task-done', bg: 'bg-task-done-bg', dot: 'bg-task-done', next: null },
}

export const RECURRENCES = {
  daily: { label: 'Diaria', shortLabel: 'Diaria' },
  weekly: { label: 'Semanal', shortLabel: 'Sem.' },
  monthly: { label: 'Mensual', shortLabel: 'Mens.' },
  annual: { label: 'Anual', shortLabel: 'Anual' },
}

export const TASK_TYPES = {
  single: { label: 'Tarea Única' },
  recurring: { label: 'Tarea Recurrente' },
}

export const NOTIFICATION_TYPES = {
  assigned: 'Te han asignado una tarea',
  verify_requested: 'Tarea pendiente de verificación',
  due_soon: 'Tarea próxima a vencer',
  comment: 'Nuevo comentario en una tarea',
  status_changed: 'Estado de tarea actualizado',
  completed: 'Tarea completada para verificar',
}

export const SORT_OPTIONS = [
  { value: 'priority', label: 'Urgencia' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'createdAt', label: 'Fecha creación' },
  { value: 'status', label: 'Estado' },
  { value: 'title', label: 'Nombre' },
]

export const WEEK_DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
