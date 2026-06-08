import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import { PRIORITIES } from '../utils/constants'
import { isToday, isThisWeek, isThisMonth, isBefore, startOfDay } from 'date-fns'
import { CheckSquare, Clock, AlertCircle, TrendingUp, Plus, CalendarDays } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import Avatar from '../components/ui/Avatar'
import { useUsers } from '../hooks/useUsers'
import { updateTask, completeAndRecur } from '../services/tasks'
import toast from 'react-hot-toast'

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-brand-text leading-none">{value}</p>
        <p className="text-xs text-brand-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function PriorityGroup({ priority, tasks, users, onEdit, onComplete }) {
  const p = PRIORITIES[priority]
  if (!tasks.length) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className={`w-2 h-2 rounded-full ${p.dot}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${p.color}`}>{p.label}</span>
        <span className="text-xs text-brand-text-light">({tasks.length})</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} users={users} onEdit={onEdit} onComplete={onComplete} compact />
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { myTasks } = useTasks()
  const { currentUser, userProfile } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const { users } = useUsers()
  const [activeView, setActiveView] = useState('today')
  const [editTask, setEditTask] = useState(null)

  // Lógica unificada para filtrar tareas de hoy:
  // - recurrentes diarias sin fecha límite → siempre aparecen hoy
  // - con fecha límite hoy o vencidas (no completadas)
  const todayTasks = useMemo(() => myTasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueDate) return t.recurrence === 'daily'
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
    return isToday(d) || isBefore(d, startOfDay(new Date()))
  }), [myTasks])

  const weekTasks = useMemo(() => myTasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueDate) return t.recurrence === 'weekly'
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
    return isThisWeek(d, { weekStartsOn: 1 })
  }), [myTasks])

  const monthTasks = useMemo(() => myTasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueDate) return t.recurrence === 'monthly'
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
    return isThisMonth(d)
  }), [myTasks])

  const displayTasks = activeView === 'today' ? todayTasks : activeView === 'week' ? weekTasks : monthTasks

  const grouped = useMemo(() => {
    const g = { urgent: [], important: [], low: [] }
    displayTasks.forEach((t) => { if (g[t.priority]) g[t.priority].push(t) })
    return g
  }, [displayTasks])

  const stats = useMemo(() => {
    const done = myTasks.filter((t) => t.status === 'done').length
    const inProgress = myTasks.filter((t) => t.status === 'in_progress').length
    const overdue = myTasks.filter((t) => {
      if (t.status === 'done' || !t.dueDate) return false
      const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
      return isBefore(d, startOfDay(new Date()))
    }).length
    const urgent = myTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length
    return { done, inProgress, overdue, urgent }
  }, [myTasks])

  const handleEdit = (task) => { setEditTask(task); setShowModal(true) }
  const handleClose = () => { setShowModal(false); setEditTask(null) }

  const handleComplete = async (task) => {
    try {
      if (task.type === 'recurring' && task.recurrence) {
        await completeAndRecur(task, currentUser.uid)
        toast.success('✓ Completada. Próxima recurrencia creada.')
      } else {
        await updateTask(task.id, { status: 'done' })
        toast.success('✓ Tarea finalizada')
      }
    } catch { toast.error('Error al completar la tarea') }
  }

  const VIEWS = [
    { key: 'today', label: 'Hoy', count: todayTasks.length },
    { key: 'week', label: 'Esta semana', count: weekTasks.length },
    { key: 'month', label: 'Este mes', count: monthTasks.length },
  ]

  return (
    <div>
      <Header title="Mi panel" action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <Avatar name={userProfile?.displayName} size="md" />
          <div>
            <h2 className="text-base font-bold text-brand-text">Hola, {userProfile?.displayName?.split(' ')[0]} 👋</h2>
            <p className="text-xs text-brand-text-muted">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Completadas" value={stats.done} icon={CheckSquare} color="text-green-600" bg="bg-green-50" />
          <StatCard label="En curso" value={stats.inProgress} icon={Clock} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Vencidas" value={stats.overdue} icon={AlertCircle} color="text-red-600" bg="bg-red-50" />
          <StatCard label="Urgentes" value={stats.urgent} icon={TrendingUp} color="text-brand-orange" bg="bg-brand-orange-light" />
        </div>

        <div>
          <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-xl mb-4 w-fit">
            {VIEWS.map(({ key, label, count }) => (
              <button key={key} onClick={() => setActiveView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeView === key ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
                <CalendarDays size={13} />
                {label}
                {count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeView === key ? 'bg-brand-orange text-white' : 'bg-brand-border text-brand-text-muted'}`}>{count}</span>}
              </button>
            ))}
          </div>

          {displayTasks.length === 0 ? (
            <EmptyState icon={CheckSquare}
              title={`Sin tareas para ${VIEWS.find((v) => v.key === activeView)?.label.toLowerCase()}`}
              description="¡Estás al día! Crea una nueva tarea si es necesario."
              action={<button onClick={() => setShowModal(true)} className="btn-primary text-sm"><Plus size={15} /> Nueva tarea</button>}
            />
          ) : (
            <div className="space-y-5">
              {['urgent', 'important', 'low'].map((p) => (
                <PriorityGroup key={p} priority={p} tasks={grouped[p]} users={users} onEdit={handleEdit} onComplete={handleComplete} />
              ))}
            </div>
          )}
        </div>
      </div>
      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
