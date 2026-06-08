import { Link } from 'react-router-dom'
import PriorityBadge from '../ui/PriorityBadge'
import StatusBadge from '../ui/StatusBadge'
import Avatar from '../ui/Avatar'
import { formatRelative, isOverdue, isDueSoon } from '../../utils/dates'
import { RECURRENCES } from '../../utils/constants'
import { Calendar, RefreshCw, MessageSquare, AlertCircle, Clock } from 'lucide-react'

export default function TaskCard({ task, users = [], onEdit, compact = false }) {
  const assignee = users.find((u) => u.uid === task.assignedTo)
  const verifier = users.find((u) => u.uid === task.verifiedBy)
  const overdue = isOverdue(task.dueDate, task.status)
  const dueSoon = isDueSoon(task.dueDate, task.status)

  return (
    <div className={`card hover:shadow-card-hover transition-all duration-200 cursor-pointer group ${overdue ? 'border-red-200' : ''}`}>
      <Link to={`/tasks/${task.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.type === 'recurring' && task.recurrence && (
              <span className="badge bg-brand-bg-2 text-brand-text-muted border border-brand-border text-xs">
                <RefreshCw size={10} />
                {RECURRENCES[task.recurrence]?.shortLabel}
              </span>
            )}
          </div>
        </div>

        <h3 className={`text-sm font-semibold text-brand-text leading-snug mb-1 ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
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
            {task.dueDate && (
              <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-semibold' : dueSoon ? 'text-amber-500' : 'text-brand-text-muted'}`}>
                {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                <span>{formatRelative(task.dueDate)}</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {onEdit && (
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
