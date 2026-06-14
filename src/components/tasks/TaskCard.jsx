import { useState } from 'react'
import PriorityBadge from '../ui/PriorityBadge'
import StatusBadge from '../ui/StatusBadge'
import Avatar from '../ui/Avatar'
import { formatRelative, isOverdue, isDueSoon } from '../../utils/dates'
import { RECURRENCES } from '../../utils/constants'
import { Calendar, RefreshCw, AlertCircle, CheckCircle2, GripVertical } from 'lucide-react'

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

export default function TaskCard({
  task, users = [], onEdit, onComplete, onVerify, compact = false,
  sortable = false, onDragStart, onDragEnter, onDrop,
}) {
  const [dragging, setDragging] = useState(false)
  const assignee = users.find((u) => u.uid === task.assignedTo)
  const verifier = users.find((u) => u.uid === task.verifiedBy)
  const isDone = task.status === 'done'

  const isRecurring = task.type === 'recurring' && !!task.recurrence
  const effectiveDate = task.dueDate || (isRecurring ? task.startDate : null)
  const overdue = isOverdue(effectiveDate, task.status)
  const dueSoon = isDueSoon(effectiveDate, task.status)
  const patternLabel = isRecurring ? getRecurrencePattern(task) : ''

  return (
    <div
      draggable={sortable}
      onDragStart={sortable ? (e) => { e.stopPropagation(); setDragging(true); onDragStart?.(task.id) } : undefined}
      onDragEnd={sortable ? () => setDragging(false) : undefined}
      onDragEnter={sortable ? (e) => { e.preventDefault(); onDragEnter?.(task.id) } : undefined}
      onDragOver={sortable ? (e) => e.preventDefault() : undefined}
      onDrop={sortable ? (e) => { e.preventDefault(); onDrop?.() } : undefined}
      onClick={() => { if (onEdit && !isDone) onEdit(task) }}
      className={[
        'card hover:shadow-card-hover transition-all duration-200 group relative',
        onEdit && !isDone ? 'cursor-pointer' : '',
        overdue ? 'border-red-200' : '',
        isDone ? 'opacity-70' : '',
        dragging ? 'opacity-40 scale-95' : '',
        sortable ? 'pl-6' : '',
      ].join(' ')}
    >
      {sortable && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-brand-text-muted opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing select-none">
          <GripVertical size={14} />
        </div>
      )}

      <div className="p-4">
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
              onClick={(e) => { e.stopPropagation(); onComplete(task) }}
              title="Marcar como finalizada"
              className="flex-shrink-0 p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
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
      </div>

      {onVerify && task.status === 'pending_response' && (
        <div className="px-4 pb-3 border-t border-brand-border">
          <button
            onClick={(e) => { e.stopPropagation(); onVerify(task) }}
            className="w-full mt-2 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            ✓ Verificar y cerrar
          </button>
        </div>
      )}
    </div>
  )
}
