import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import { PRIORITIES } from '../utils/constants'
import { isToday, isThisWeek, isThisMonth, isBefore, startOfDay } from 'date-fns'
import { CheckSquare, Clock, AlertCircle, TrendingUp, Plus, CalendarDays, RefreshCw, Eye } from 'lucide-react'
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

function MiniColumn({ title, icon: Icon, iconColor, tasks, users, onComplete, onEdit }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Icon size={13} className={iconColor} />
        <span className="text-xs font-bold text-brand-text uppercase tracking-wide">{title}</span>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs bg-brand-bg-2 text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">
            {tasks.length}
          </span>
        )}
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-brand-border py-6 text-center">
          <p className="text-xs text-brand-text-light">Sin tareas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} users={users} onComplete={onComplete} onEdit={onEdit} compact />
          ))}
        </div>
      )}
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

  const filterByView = (tasks, view) => {
    return tasks.filter((t) => {
      if (t.status === 'done') return false
      if (view === 'today') {
        if (!t.dueDate) return t.recurrence === 'daily'
        const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
        return isToday(d) || isBefore(d, startOfDay(new Date()))
      }
      if (view === 'week') {
        if (!t.dueDate) return t.recurrence === 'weekly'
        const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
        return isThisWeek(d, { weekStartsOn: 1 })
      }
      if (view === 'month') {
        if (!t.dueDate) return t.recurrence === 'monthly'
        const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
        return isThisMonth(d)
      }
      return false
    })
  }

  const sortByPriority = (tasks) =>
    [...tasks].sort((a, b) => (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9))

  const viewTasks = useMemo(() => filterByView(myTasks, activeView), [myTasks, activeView])

  const { normalTasks, recurringTasks, supervisionTasks } = useMemo(() => {
    const uid = currentUser?.uid || ''
    const normal = [], recurring = [], supervision = []
    viewTasks.forEach((t) => {
      if (t.verifiedBy === uid && t.assignedTo !== uid) supervision.push(t)
      else if (t.type === 'recurring') recurring.push(t)
      else normal.push(t)
    })
    return { normalTasks: sortByPriority(normal), recurringTasks: sortByPriority(recurring), supervisionTasks: sortByPriority(supervision) }
  }, [viewTasks, currentUser])

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
    { key: 'today', label: 'Hoy', count: filterByView(myTasks.filter(t=>t.status!=='done'), 'today').length },
    { key: 'week', label: 'Esta semana', count: filterByView(myTasks.filter(t=>t.status!=='done'), 'week').length },
    { key: 'month', label: 'Este mes', count: filterByView(myTasks.filter(t=>t.status!=='done'), 'month').length },
  ]

  return (
    <div>
      <Header title="Mi panel" action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 space-y-5 max-w-6xl">
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

        {/* Selector de vista */}
        <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-xl w-fit">
          {VIEWS.map(({ key, label, count }) => (
            <button key={key} onClick={() => setActiveView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeView === key ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
              <CalendarDays size={12} />
              {label}
              {count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeView === key ? 'bg-brand-orange text-white' : 'bg-brand-border text-brand-text-muted'}`}>{count}</span>}
            </button>
          ))}
        </div>

        {/* 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <MiniColumn title="Tareas" icon={CheckSquare} iconColor="text-brand-orange" tasks={normalTasks} users={users} onComplete={handleComplete} onEdit={handleEdit} />
          <MiniColumn title="Recurrentes" icon={RefreshCw} iconColor="text-blue-500" tasks={recurringTasks} users={users} onComplete={handleComplete} onEdit={handleEdit} />
          <MiniColumn title="Supervisión" icon={Eye} iconColor="text-amber-500" tasks={supervisionTasks} users={users} onComplete={handleComplete} onEdit={null} />
        </div>
      </div>

      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
