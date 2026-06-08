import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import { PRIORITIES } from '../utils/constants'
import { isToday, isThisWeek, isThisMonth, isBefore, startOfDay } from 'date-fns'
import { CheckSquare, Clock, AlertCircle, TrendingUp, Plus, CalendarDays, RefreshCw, Eye, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import { useUsers } from '../hooks/useUsers'
import { updateTask, completeAndRecur } from '../services/tasks'
import { createNotification } from '../services/notifications'
import toast from 'react-hot-toast'

const SORT_OPTS = [
  { value: 'priority', label: 'Urgencia' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'status', label: 'Estado' },
  { value: 'title', label: 'Nombre' },
]

function applyColumnFilter(tasks, sort, search, priority) {
  let r = [...tasks]
  if (search) { const q = search.toLowerCase(); r = r.filter((t) => t.title.toLowerCase().includes(q)) }
  if (priority) r = r.filter((t) => t.priority === priority)
  r.sort((a, b) => {
    switch (sort) {
      case 'priority': return (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9)
      case 'dueDate': {
        const da = a.dueDate?.toDate ? a.dueDate.toDate() : a.dueDate ? new Date(a.dueDate) : new Date('9999')
        const db = b.dueDate?.toDate ? b.dueDate.toDate() : b.dueDate ? new Date(b.dueDate) : new Date('9999')
        return da - db
      }
      case 'status': return (a.status || '').localeCompare(b.status || '')
      case 'title': return a.title.localeCompare(b.title)
      default: return (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9)
    }
  })
  return r
}

function ColumnHeader({ title, icon: Icon, iconColor, count, sort, setSort, search, setSearch, priority, setPriority }) {
  const [open, setOpen] = useState(false)
  const hasFilters = search || priority
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-1">
        <Icon size={13} className={iconColor} />
        <span className="text-xs font-bold text-brand-text uppercase tracking-wide">{title}</span>
        {count > 0 && <span className="ml-1 text-xs bg-brand-bg-2 text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">{count}</span>}
        <button onClick={() => setOpen(!open)}
          className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${open || hasFilters ? 'bg-brand-orange text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:bg-brand-bg-3'}`}>
          <SlidersHorizontal size={11} />
          {hasFilters ? 'Filtrado' : 'Filtrar'}
        </button>
      </div>
      {open && (
        <div className="mt-2 bg-brand-bg-2 rounded-lg p-3 space-y-3 border border-brand-border animate-fade-in">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Filtrar</p>
            <input type="text" placeholder="Buscar..." className="input-field text-xs py-1.5"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="relative">
              <select className="select-field text-xs py-1.5 pr-7" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Todas las urgencias</option>
                <option value="urgent">Urgente</option>
                <option value="important">Importante</option>
                <option value="low">No urgente</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-brand-border">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Ordenar</p>
            <div className="relative">
              <select className="select-field text-xs py-1.5 pr-7" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setPriority('') }} className="text-xs text-brand-text-muted hover:text-brand-text flex items-center gap-1">
              <X size={11} /> Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function useColState() {
  const [sort, setSort] = useState('priority')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  return { sort, setSort, search, setSearch, priority, setPriority }
}

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


export default function Dashboard() {
  const { myTasks } = useTasks()
  const { currentUser, userProfile } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const { users } = useUsers()
  const [activeView, setActiveView] = useState('today')
  const [editTask, setEditTask] = useState(null)
  const normalCol = useColState()
  const recurringCol = useColState()
  const supervisionCol = useColState()

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
      } else if (task.verifiedBy && task.verifiedBy !== currentUser.uid) {
        await updateTask(task.id, { status: 'pending_response' })
        await createNotification({ recipientId: task.verifiedBy, taskId: task.id, taskTitle: task.title, type: 'completed', senderName: userProfile?.displayName })
        toast.success('✓ Enviada a verificación')
      } else {
        await updateTask(task.id, { status: 'done' })
        toast.success('✓ Tarea finalizada')
      }
    } catch { toast.error('Error al completar la tarea') }
  }

  const handleVerify = async (task) => {
    try { await updateTask(task.id, { status: 'done' }); toast.success('✓ Verificada y cerrada') }
    catch { toast.error('Error al verificar') }
  }

  const filteredNormal = useMemo(() => applyColumnFilter(normalTasks, normalCol.sort, normalCol.search, normalCol.priority), [normalTasks, normalCol.sort, normalCol.search, normalCol.priority])
  const filteredRecurring = useMemo(() => applyColumnFilter(recurringTasks, recurringCol.sort, recurringCol.search, recurringCol.priority), [recurringTasks, recurringCol.sort, recurringCol.search, recurringCol.priority])
  const filteredSupervision = useMemo(() => applyColumnFilter(supervisionTasks, supervisionCol.sort, supervisionCol.search, supervisionCol.priority), [supervisionTasks, supervisionCol.sort, supervisionCol.search, supervisionCol.priority])

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
          <div>
            <ColumnHeader title="Tareas" icon={CheckSquare} iconColor="text-brand-orange" count={filteredNormal.length} {...normalCol} />
            <div className="space-y-2">
              {filteredNormal.length === 0 ? <div className="rounded-xl border-2 border-dashed border-brand-border py-6 text-center"><p className="text-xs text-brand-text-light">Sin tareas</p></div>
                : filteredNormal.map((t) => <TaskCard key={t.id} task={t} users={users} onComplete={handleComplete} onEdit={handleEdit} compact />)}
            </div>
          </div>
          <div>
            <ColumnHeader title="Recurrentes" icon={RefreshCw} iconColor="text-blue-500" count={filteredRecurring.length} {...recurringCol} />
            <div className="space-y-2">
              {filteredRecurring.length === 0 ? <div className="rounded-xl border-2 border-dashed border-brand-border py-6 text-center"><p className="text-xs text-brand-text-light">Sin recurrentes</p></div>
                : filteredRecurring.map((t) => <TaskCard key={t.id} task={t} users={users} onComplete={handleComplete} onEdit={handleEdit} compact />)}
            </div>
          </div>
          <div>
            <ColumnHeader title="Supervisión" icon={Eye} iconColor="text-amber-500" count={filteredSupervision.length} {...supervisionCol} />
            <div className="space-y-2">
              {filteredSupervision.length === 0 ? <div className="rounded-xl border-2 border-dashed border-brand-border py-6 text-center"><p className="text-xs text-brand-text-light">Sin supervisión</p></div>
                : filteredSupervision.map((t) => (
                  <div key={t.id}>
                    <TaskCard task={t} users={users} onComplete={t.status === 'pending_response' ? handleVerify : handleComplete} onEdit={null} compact />
                    {t.status === 'pending_response' && (
                      <button onClick={() => handleVerify(t)} className="w-full mt-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                        ✓ Verificar y cerrar
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
