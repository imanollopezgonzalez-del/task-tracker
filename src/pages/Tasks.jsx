import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import { PRIORITIES } from '../utils/constants'
import { isToday, isThisWeek, isThisMonth, isBefore, startOfDay, startOfWeek, endOfWeek } from 'date-fns'
import { CheckSquare, Clock, AlertCircle, TrendingUp, RefreshCw, Eye, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
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

const VIEWS = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'done', label: 'Completadas' },
]

function filterByView(tasks, view) {
  if (view === 'done') return tasks.filter((t) => t.status === 'done')
  return tasks.filter((t) => {
    if (t.status === 'done') return false

    const toDate = (ts) => ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null
    const due = toDate(t.dueDate)
    const start = toDate(t.startDate)
    const now = new Date()

    // Recurrentes: visibilidad por patrón, no por dueDate exacto
    if (t.type === 'recurring' && t.recurrence) {
      const startRef = start || due
      // No mostrar si la tarea aún no empezó
      if (startRef && isBefore(startOfDay(now), startRef)) return false

      const cfg = t.recurrenceConfig || {}
      if (view === 'today') {
        if (t.recurrence === 'daily') return true
        if (t.recurrence === 'weekly') {
          const days = cfg.days?.length ? cfg.days : [1, 2, 3, 4, 5]
          return days.includes(now.getDay())
        }
        if (t.recurrence === 'monthly') {
          const dom = cfg.dayOfMonth || due?.getDate() || start?.getDate()
          return dom ? now.getDate() === dom : false
        }
        if (t.recurrence === 'annual') {
          const base = due || start
          return base ? now.getDate() === base.getDate() && now.getMonth() === base.getMonth() : false
        }
        return false
      }
      if (view === 'week') {
        if (t.recurrence === 'daily' || t.recurrence === 'weekly') return true
        if (t.recurrence === 'monthly') {
          const dom = cfg.dayOfMonth || due?.getDate() || start?.getDate()
          if (!dom) return false
          const wStart = startOfWeek(now, { weekStartsOn: 1 })
          const wEnd = endOfWeek(now, { weekStartsOn: 1 })
          const sched = new Date(now.getFullYear(), now.getMonth(), dom)
          return sched >= wStart && sched <= wEnd
        }
        if (t.recurrence === 'annual') {
          const base = due || start
          if (!base) return false
          const wStart = startOfWeek(now, { weekStartsOn: 1 })
          const wEnd = endOfWeek(now, { weekStartsOn: 1 })
          const sched = new Date(now.getFullYear(), base.getMonth(), base.getDate())
          return sched >= wStart && sched <= wEnd
        }
        return false
      }
      if (view === 'month') {
        if (t.recurrence === 'annual') {
          const base = due || start
          return base ? base.getMonth() === now.getMonth() : false
        }
        return true
      }
      return false
    }

    // Tarea única: dueDate con startDate como respaldo
    const ref = due ?? start
    if (!ref) return true  // sin fechas: siempre visible

    const past = isBefore(ref, startOfDay(now))
    if (view === 'today') return isToday(ref) || past
    if (view === 'week') return isThisWeek(ref, { weekStartsOn: 1 }) || past
    if (view === 'month') return isThisMonth(ref) || past
    return false
  })
}

function applyColumnFilter(tasks, sort, search, priority) {
  let r = [...tasks]
  if (search) { const q = search.toLowerCase(); r = r.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) }
  if (priority) r = r.filter((t) => t.priority === priority)
  r.sort((a, b) => {
    switch (sort) {
      case 'priority': return (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9)
      case 'dueDate': {
        const da = a.dueDate?.toDate ? a.dueDate.toDate() : a.dueDate ? new Date(a.dueDate) : new Date('9999')
        const db2 = b.dueDate?.toDate ? b.dueDate.toDate() : b.dueDate ? new Date(b.dueDate) : new Date('9999')
        return da - db2
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
    <div className="mb-3">
      <div className="flex items-center gap-2 px-1">
        <Icon size={14} className={iconColor} />
        <span className="text-xs font-bold text-brand-text uppercase tracking-wide">{title}</span>
        {count > 0 && <span className="ml-1 text-xs bg-brand-bg-2 text-brand-text-muted px-2 py-0.5 rounded-full border border-brand-border">{count}</span>}
        <button onClick={() => setOpen(!open)}
          className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${open || hasFilters ? 'bg-brand-orange text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:bg-brand-bg-3 hover:text-brand-text'}`}>
          <SlidersHorizontal size={11} />
          {hasFilters ? 'Filtrado' : 'Filtrar'}
        </button>
      </div>
      {open && (
        <div className="mt-2 bg-brand-bg-2 rounded-lg p-3 space-y-3 border border-brand-border animate-fade-in">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Filtrar</p>
            <input type="text" placeholder="Buscar por título..." className="input-field text-xs py-1.5"
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

export default function Tasks() {
  const { myTasks, allTasks } = useTasks()
  const { currentUser, userProfile } = useAuth()
  const { users } = useUsers()
  const isAdmin = userProfile?.role === 'admin'

  const [activeView, setActiveView] = useState('today')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [selectedUid, setSelectedUid] = useState('me')

  const normalCol = useColState()
  const recurringCol = useColState()
  const supervisionCol = useColState()

  const sourceTasks = useMemo(() => {
    if (!isAdmin) return myTasks
    if (selectedUid === 'all') return allTasks
    const uid = selectedUid === 'me' ? currentUser?.uid : selectedUid
    return allTasks.filter((t) => t.assignedTo === uid || t.verifiedBy === uid)
  }, [isAdmin, allTasks, myTasks, selectedUid, currentUser])

  const viewUid = useMemo(() => {
    if (!isAdmin) return currentUser?.uid
    return selectedUid === 'me' ? currentUser?.uid : selectedUid === 'all' ? null : selectedUid
  }, [isAdmin, selectedUid, currentUser])

  const viewTasks = useMemo(() => filterByView(sourceTasks, activeView), [sourceTasks, activeView])

  const { normalTasks, recurringTasks, supervisionTasks } = useMemo(() => {
    const uid = viewUid || ''
    const normal = [], recurring = [], supervision = []
    viewTasks.forEach((t) => {
      if (t.verifiedBy === uid && t.assignedTo !== uid) supervision.push(t)
      else if (t.type === 'recurring') recurring.push(t)
      else normal.push(t)
    })
    const byPriority = (arr) => [...arr].sort((a, b) => (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9))
    return { normalTasks: byPriority(normal), recurringTasks: byPriority(recurring), supervisionTasks: byPriority(supervision) }
  }, [viewTasks, viewUid])

  const stats = useMemo(() => {
    const base = isAdmin && selectedUid !== 'me' ? sourceTasks : myTasks
    const done = base.filter((t) => t.status === 'done').length
    const inProgress = base.filter((t) => t.status === 'in_progress').length
    const overdue = base.filter((t) => {
      if (t.status === 'done' || !t.dueDate) return false
      const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
      return isBefore(d, startOfDay(new Date()))
    }).length
    const urgent = base.filter((t) => t.priority === 'urgent' && t.status !== 'done').length
    return { done, inProgress, overdue, urgent }
  }, [myTasks, sourceTasks, isAdmin, selectedUid])

  const viewCounts = useMemo(() => Object.fromEntries(VIEWS.map(({ key }) => [key, filterByView(sourceTasks, key).length])), [sourceTasks])

  const filteredNormal = useMemo(() => applyColumnFilter(normalTasks, normalCol.sort, normalCol.search, normalCol.priority), [normalTasks, normalCol.sort, normalCol.search, normalCol.priority])
  const filteredRecurring = useMemo(() => applyColumnFilter(recurringTasks, recurringCol.sort, recurringCol.search, recurringCol.priority), [recurringTasks, recurringCol.sort, recurringCol.search, recurringCol.priority])
  const filteredSupervision = useMemo(() => applyColumnFilter(supervisionTasks, supervisionCol.sort, supervisionCol.search, supervisionCol.priority), [supervisionTasks, supervisionCol.sort, supervisionCol.search, supervisionCol.priority])

  const handleEdit = (task) => { setEditTask(task); setShowModal(true) }
  const handleClose = () => { setShowModal(false); setEditTask(null) }

  const handleComplete = async (task) => {
    try {
      // Verificación va primero, incluso en recurrentes
      if (task.verifiedBy && task.verifiedBy !== currentUser.uid) {
        await updateTask(task.id, { status: 'pending_response' })
        await createNotification({ recipientId: task.verifiedBy, taskId: task.id, taskTitle: task.title, type: 'completed', senderName: userProfile?.displayName })
        toast.success('✓ Enviada a verificación')
      } else if (task.type === 'recurring' && task.recurrence) {
        await completeAndRecur(task, currentUser.uid)
        toast.success('✓ Completada. Próxima ocurrencia creada.')
      } else {
        await updateTask(task.id, { status: 'done' })
        toast.success('✓ Tarea finalizada')
      }
    } catch { toast.error('Error al completar la tarea') }
  }

  const handleVerify = async (task) => {
    try {
      if (task.type === 'recurring' && task.recurrence) {
        await completeAndRecur(task, currentUser.uid)
        toast.success('✓ Verificada y cerrada. Próxima ocurrencia creada.')
      } else {
        await updateTask(task.id, { status: 'done' })
        toast.success('✓ Verificada y cerrada')
      }
    } catch { toast.error('Error al verificar') }
  }

  const canEdit = (task) => isAdmin || task.assignedTo === currentUser?.uid

  return (
    <div>
      <Header title="Tareas" action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 space-y-5 max-w-6xl">

        {!isAdmin && (
          <div className="flex items-center gap-3">
            <Avatar name={userProfile?.displayName} size="md" />
            <div>
              <h2 className="text-base font-bold text-brand-text">Hola, {userProfile?.displayName?.split(' ')[0]} 👋</h2>
              <p className="text-xs text-brand-text-muted">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Completadas" value={stats.done} icon={CheckSquare} color="text-green-600" bg="bg-green-50" />
          <StatCard label="En curso" value={stats.inProgress} icon={Clock} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Vencidas" value={stats.overdue} icon={AlertCircle} color="text-red-600" bg="bg-red-50" />
          <StatCard label="Urgentes" value={stats.urgent} icon={TrendingUp} color="text-brand-orange" bg="bg-brand-orange-light" />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-text-muted font-medium flex-shrink-0">Ver de:</span>
            <div className="relative">
              <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)}
                className="select-field pr-8 py-1.5 text-sm pl-3 min-w-44 font-medium">
                <option value="me">Mis tareas</option>
                <option value="all">Todo el equipo</option>
                {users.filter((u) => u.uid !== currentUser?.uid).map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-brand-bg-2 p-1 rounded-xl w-fit">
          {VIEWS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeView === key ? 'bg-white shadow-card text-brand-text' : 'text-brand-text-muted hover:text-brand-text'}`}>
              {label}
              {viewCounts[key] > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeView === key ? 'bg-brand-orange text-white' : 'bg-brand-border text-brand-text-muted'}`}>
                  {viewCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div>
            <ColumnHeader title="Tareas" icon={CheckSquare} iconColor="text-brand-orange" count={filteredNormal.length} {...normalCol} />
            <div className="space-y-2">
              {filteredNormal.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
                  <p className="text-xs text-brand-text-light">Sin tareas</p>
                </div>
              ) : filteredNormal.map((task) => (
                <TaskCard key={task.id} task={task} users={users} onEdit={canEdit(task) ? handleEdit : null} onComplete={handleComplete} />
              ))}
            </div>
          </div>

          <div>
            <ColumnHeader title="Recurrentes" icon={RefreshCw} iconColor="text-blue-500" count={filteredRecurring.length} {...recurringCol} />
            <div className="space-y-2">
              {filteredRecurring.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
                  <p className="text-xs text-brand-text-light">Sin recurrentes</p>
                </div>
              ) : filteredRecurring.map((task) => (
                <TaskCard key={task.id} task={task} users={users} onEdit={canEdit(task) ? handleEdit : null} onComplete={handleComplete} />
              ))}
            </div>
          </div>

          <div>
            <ColumnHeader title="Supervisión" icon={Eye} iconColor="text-amber-500" count={filteredSupervision.length} {...supervisionCol} />
            <div className="space-y-2">
              {filteredSupervision.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
                  <p className="text-xs text-brand-text-light">Sin supervisión</p>
                </div>
              ) : filteredSupervision.map((task) => (
                <div key={task.id}>
                  <TaskCard task={task} users={users} onEdit={isAdmin ? handleEdit : null}
                    onComplete={task.status === 'pending_response' ? handleVerify : handleComplete} />
                  {task.status === 'pending_response' && (
                    <button onClick={() => handleVerify(task)}
                      className="w-full mt-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
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
