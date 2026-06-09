import { Link } from 'react-router-dom'
import PriorityBadge from '../ui/PriorityBadge'
import StatusBadge from '../ui/StatusBadge'
import Avatar from '../ui/Avatar'
import { formatRelative, isOverdue, isDueSoon } from '../../utils/dates'
import { RECURRENCES } from '../../utils/constants'
import { Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

const tsToDate = (v) => v?.toDate ? v.toDate() : v ? new Date(v) : null

function getRecurrencePattern(task) {
  const cfg = task.recurrenceConfig || {}
  switch (task.recurrence) {
    case 'weekly':
      return (cfg.days?.length ? cfg.days : [1,2,3,4,5])
        .map((d) => ['D','L','M','X','J','V','S'][d]).join(' ')
    case 'monthly': {
      const dom = cfg.dayOfMonth
        || tsToDate(task.dueDate)?.getDate()
        || tsToDate(task.startDate)?.getDate()
      return dom ? `Día ${dom}` : 'Mensual'
    }
    case 'daily':
      return (cfg.every || 1) > 1 ? `c/${cfg.every}d` : 'Diaria'
    case 'annual':
      return 'Anual'
    default:
      return ''
  }
}

export default function TaskCard({ task, users = [], onEdit, onComplete, compact = false }) {
  const assignee = users.find((u) => u.uid === task.assignedTo)
  const verifier = users.find((u) => u.uid === task.verifiedBy)
  const isDone = task.status === 'done'

  const isRecurring = task.type === 'recurring' && !!task.recurrence
  // Para recurrentes, usar startDate como fallback si no hay dueDate
  const effectiveDate = task.dueDate || (isRecurring ? task.startDate : null)
  const overdue = isOverdue(effectiveDate, task.status)
  const dueSoon = isDueSoon(effectiveDate, task.status)
  const patternLabel = isRecurring ? getRecurrencePattern(task) : ''

  return (
    <div className={`card hover:shadow-card-hover transition-all duration-200 group ${overdue ? 'border-red-200' : ''} ${isDone ? 'opacity-70' : ''}`}>
      <Link to={`/tasks/${task.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {isRecurring && (
              <span className="badge bg-brand-bg-2 text-brand-text-muted border border-brand-border text-xs">
                <RefreshCw size={10} />
                {RECURRENCES[task.recurrence]?.shortLabel}
              </span>
            )}
          </div>
          {!isDone && onComplete && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onComplete(task) }}
              title="Marcar como finalizada"
              className="flex-shrink-0 p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
              <CheckCircle2 size={20} />
            </button>
          )}
        </div>

        <h3 className={`text-sm font-semibold text-brand-text leading-snug mb-1 ${isDone ? 'line-through opacity-60' : ''}`}>
          {task.title}
        </h3>

        {!compact && task.description && (
          <p className="text-xs text-brand-text-muted line-clamp-2 mb-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-2">
            {assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar name={assignee.displayName || assignee.email} size="xs" />
                <span className="text-xs text-brand-text-muted hidden sm:inline truncate max-w-20">
                  {assignee.displayName?.split(' ')[0] || assignee.email}
                </span>
              </div>
            )}
            {verifier && (
              <div className="flex items-center gap-1" title={`Verifica: ${verifier.displayName}`}>
                <span className="text-xs text-brand-text-light">✓</span>
                <Avatar name={verifier.displayName || verifier.email} size="xs" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isRecurring ? (
              <>
                <div className="flex items-center gap-1 text-xs text-brand-text-muted">
                  <RefreshCw size={11} />
                  <span>{patternLabel}</span>
                </div>
                {effectiveDate && (
                  <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-semibold' : dueSoon ? 'text-amber-500' : 'text-brand-text-muted'}`}>
                    {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                    <span>{formatRelative(effectiveDate)}</span>
                  </div>
                )}
              </>
            ) : effectiveDate ? (
              <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-semibold' : dueSoon ? 'text-amber-500' : 'text-brand-text-muted'}`}>
                {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                <span>{formatRelative(effectiveDate)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </Link>

      {onEdit && !isDone && (
        <div className="px-4 pb-3 pt-0 flex gap-2 border-t border-brand-border mt-1">
          <button onClick={(e) => { e.preventDefault(); onEdit(task) }}
            className="text-xs text-brand-text-muted hover:text-brand-text font-medium transition-colors">
            Editar
          </button>
        </div>
      )}
    </div>
  )
}
