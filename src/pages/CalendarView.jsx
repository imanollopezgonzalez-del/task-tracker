import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useUsers } from '../hooks/useUsers'
import Header from '../components/layout/Header'
import TaskModal from '../components/tasks/TaskModal'
import PriorityBadge from '../components/ui/PriorityBadge'
import { useAuth } from '../contexts/AuthContext'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, X } from 'lucide-react'
import { PRIORITIES, RECURRENCES } from '../utils/constants'
import { Link } from 'react-router-dom'

const PRIORITY_DOT = { urgent: 'bg-red-500', important: 'bg-brand-orange', low: 'bg-green-500' }

export default function CalendarView() {
  const { allTasks } = useTasks()
  const { users } = useUsers()
  const { currentUser } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  // Obtener tareas para un día dado (incluyendo recurrentes)
  const getTasksForDay = (day) => {
    return allTasks.filter((t) => {
      if (t.status === 'done') return false
      if (!t.dueDate) {
        // Recurrentes sin fecha fija
        if (t.recurrence === 'daily') return true
        if (t.recurrence === 'weekly') return day.getDay() === (t.weekDay ?? 1)
        return false
      }
      const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
      return isSameDay(d, day)
    })
  }

  const selectedTasks = selectedDay ? getTasksForDay(selectedDay) : []

  // Resumen de recurrentes
  const recurringTasks = useMemo(() =>
    allTasks.filter((t) => t.type === 'recurring' && t.status !== 'done')
      .sort((a, b) => (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9))
  , [allTasks])

  const WEEK_HEADERS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  return (
    <div>
      <Header title="Calendario" action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 max-w-4xl space-y-5">

        {/* Calendar */}
        <div className="card overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn-ghost p-2">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-bold text-brand-text capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn-ghost p-2">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-brand-border">
            {WEEK_HEADERS.map((h) => (
              <div key={h} className="py-2 text-center text-xs font-semibold text-brand-text-muted">{h}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayTasks = getTasksForDay(day)
              const inMonth = isSameMonth(day, currentDate)
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const today = isToday(day)

              return (
                <button key={i} onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                  className={`min-h-[56px] p-1.5 border-b border-r border-brand-border text-left transition-colors
                    ${!inMonth ? 'bg-brand-bg opacity-40' : 'hover:bg-brand-bg'}
                    ${isSelected ? 'bg-brand-orange-light ring-2 ring-inset ring-brand-orange' : ''}
                  `}>
                  <span className={`text-xs font-semibold mb-1 inline-flex w-6 h-6 items-center justify-center rounded-full
                    ${today ? 'bg-brand-orange text-white' : isSelected ? 'text-brand-orange' : 'text-brand-text-muted'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] || 'bg-gray-400'}`} />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-xs text-brand-text-light leading-none">+{dayTasks.length - 3}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 flex items-center gap-4 border-t border-brand-border bg-brand-bg">
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[k]}`} />
                <span className="text-xs text-brand-text-muted">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected day tasks */}
        {selectedDay && (
          <div className="card p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-brand-text capitalize">
                {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-brand-text-muted hover:text-brand-text">
                <X size={16} />
              </button>
            </div>
            {selectedTasks.length === 0 ? (
              <p className="text-xs text-brand-text-muted py-3 text-center">Sin tareas este día</p>
            ) : (
              <div className="space-y-2">
                {selectedTasks.map((t) => {
                  const assignee = users.find((u) => u.uid === t.assignedTo)
                  return (
                    <Link key={t.id} to={`/tasks/${t.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-brand-bg transition-colors">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-text truncate">{t.title}</p>
                        {assignee && <p className="text-xs text-brand-text-muted">{assignee.displayName}</p>}
                      </div>
                      {t.type === 'recurring' && (
                        <span className="text-xs text-brand-text-light flex items-center gap-1">
                          <RefreshCw size={10} /> {RECURRENCES[t.recurrence]?.shortLabel}
                        </span>
                      )}
                      <PriorityBadge priority={t.priority} size="xs" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Recurring tasks summary */}
        {recurringTasks.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-bold text-brand-text mb-3 flex items-center gap-2">
              <RefreshCw size={14} className="text-brand-orange" />
              Tareas recurrentes activas
            </h3>
            <p className="text-xs text-brand-text-muted mb-3">
              Las tareas recurrentes crean automáticamente la siguiente ocurrencia al marcarlas como finalizadas.
            </p>
            <div className="space-y-2">
              {recurringTasks.map((t) => {
                const assignee = users.find((u) => u.uid === t.assignedTo)
                const nextDate = t.dueDate
                  ? (t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate))
                  : null
                return (
                  <Link key={t.id} to={`/tasks/${t.id}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-brand-bg transition-colors">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-text truncate">{t.title}</p>
                      <p className="text-xs text-brand-text-muted">
                        {RECURRENCES[t.recurrence]?.label}
                        {nextDate && ` · Próxima: ${format(nextDate, "dd/MM/yyyy")}`}
                        {assignee && ` · ${assignee.displayName}`}
                      </p>
                    </div>
                    <PriorityBadge priority={t.priority} size="xs" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <TaskModal isOpen={showModal} onClose={() => setShowModal(false)} users={users} />
    </div>
  )
}
