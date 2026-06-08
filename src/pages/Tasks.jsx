import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import EmptyState from '../components/ui/EmptyState'
import { useUsers } from '../hooks/useUsers'
import { PRIORITIES } from '../utils/constants'
import { CheckSquare, Plus, RefreshCw, Eye, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { isToday, isThisWeek, isThisMonth, isBefore, startOfDay } from 'date-fns'
import { updateTask, completeAndRecur } from '../services/tasks'
import { createNotification } from '../services/notifications'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'weekly', label: 'Semanales' },
  { key: 'monthly', label: 'Mensuales' },
  { key: 'done', label: 'Completadas' },
]

const SORT_OPTS = [
  { value: 'priority', label: 'Urgencia' },
  { value: 'dueDate', label: 'Fecha límite' },
  { value: 'status', label: 'Estado' },
  { value: 'title', label: 'Nombre' },
]

function filterByTab(tasks, tab) {
  switch (tab) {
    case 'today': return tasks.filter((t) => {
      if (t.status === 'done') return false
      if (!t.dueDate) return t.recurrence === 'daily'
      const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)
      return isToday(d) || isBefore(d, startOfDay(new Date()))
    })
    case 'weekly': return tasks.filter((t) => t.status !== 'done' && (t.recurrence === 'weekly' || (t.dueDate && isThisWeek(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate), { weekStartsOn: 1 }))))
    case 'monthly': return tasks.filter((t) => t.status !== 'done' && (t.recurrence === 'monthly' || (t.dueDate && isThisMonth(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)))))
    case 'done': return tasks.filter((t) => t.status === 'done')
    default: return tasks.filter((t) => t.status !== 'done')
  }
}

function applySort(tasks, sort, search, priority) {
  let r = [...tasks]
  if (search) { const q = search.toLowerCase(); r = r.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) }
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
          {/* Filtrar */}
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
          {/* Ordenar */}
          <div className="space-y-2 pt-2 border-t border-brand-border">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Ordenar</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select className="select-field text-xs py-1.5 pr-7" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          </div>
          {(search || priority) && (
            <button onClick={() => { setSearch(''); setPriority('') }} className="text-xs text-brand-text-muted hover:text-brand-text flex items-center gap-1">
              <X size={11} /> Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function useColumnState() {
  const [sort, setSort] = useState('priority')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('')
  return { sort, setSort, search, setSearch, priority, setPriority }
}

export default function Tasks() {
  const { myTasks, allTasks } = useTasks()
  const { currentUser, userProfile } = useAuth()
  const { users } = useUsers()
  const isAdmin = userProfile?.role === 'admin'

  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [selectedUid, setSelectedUid] = useState('me')

  const normalState = useColumnState()
  const recurringState = useColumnState()
  const supervisionState = useColumnState()

  const viewUid = useMemo(() => {
    if (!isAdmin) return currentUser?.uid
    return selectedUid === 'me' ? currentUser?.uid : selectedUid === 'all' ? null : selectedUid
  }, [isAdmin, selectedUid, currentUser])

  const source = useMemo(() => {
    if (!isAdmin) return myTasks
    if (selectedUid === 'all') return allTasks
    const uid = selectedUid === 'me' ? currentUser?.uid : selectedUid
    return allTasks.filter((t) => t.assignedTo === uid || t.verifiedBy === uid)
  }, [isAdmin, allTasks, myTasks, selectedUid, currentUser])

  const tabFiltered = useMemo(() => filterByTab(source, tab), [source, tab])

  const { normalTasks, recurringTasks, supervisionTasks } = useMemo(() => {
    const uid = viewUid || ''
    const normal = [], recurring = [], supervision = []
    tabFiltered.forEach((t) => {
      if (t.verifiedBy === uid && t.assignedTo !== uid) supervision.push(t)
      else if (t.type === 'recurring') recurring.push(t)
      else normal.push(t)
    })
    return { normalTasks: normal, recurringTasks: recurring, supervisionTasks: supervision }
  }, [tabFiltered, viewUid])

  const handleEdit = (task) => { setEditTask(task); setShowModal(true) }
  const handleClose = () => { setShowModal(false); setEditTask(null) }

  const handleComplete = async (task) => {
    try {
      if (task.type === 'recurring' && task.recurrence) {
        await completeAndRecur(task, currentUser.uid)
        toast.success('✓ Completada. Próxima recurrencia creada.')
      } else if (task.verifiedBy && task.verifiedBy !== currentUser.uid) {
        // Tiene verificador → pasa a "Pend. Verificación"
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
    try {
      await updateTask(task.id, { status: 'done' })
      toast.success('✓ Tarea verificada y cerrada')
    } catch { toast.error('Error al verificar') }
  }

  const canEdit = (task) => isAdmin || task.assignedTo === currentUser?.uid

  const tabCounts = useMemo(() => Object.fromEntries(TABS.map(({ key }) => [key, filterByTab(source, key).length])), [source])

  const filteredNormal = useMemo(() => applySort(normalTasks, normalState.sort, normalState.search, normalState.priority), [normalTasks, normalState.sort, normalState.search, normalState.priority])
  const filteredRecurring = useMemo(() => applySort(recurringTasks, recurringState.sort, recurringState.search, recurringState.priority), [recurringTasks, recurringState.sort, recurringState.search, recurringState.priority])
  const filteredSupervision = useMemo(() => applySort(supervisionTasks, supervisionState.sort, supervisionState.search, supervisionState.priority), [supervisionTasks, supervisionState.sort, supervisionState.search, supervisionState.priority])

  return (
    <div>
      <Header title={isAdmin ? 'Tareas del equipo' : 'Mis Tareas'} action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 space-y-4 max-w-6xl">

        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-text-muted font-medium flex-shrink-0">Ver de:</span>
            <div className="relative">
              <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)}
                className="select-field pr-8 py-1.5 text-sm pl-3 min-w-44 font-medium">
                <option value="me">Mis tareas</option>
                <option value="all">Todo el equipo</option>
                {users.filter(u => u.uid !== currentUser?.uid).map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${tab === key ? 'bg-brand-dark text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:bg-brand-bg-3'}`}>
              {label}
              {tabCounts[key] > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === key ? 'bg-white/20' : 'bg-brand-border text-brand-text-muted'}`}>{tabCounts[key]}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna Tareas */}
          <div>
            <ColumnHeader title="Tareas" icon={CheckSquare} iconColor="text-brand-orange" count={filteredNormal.length} {...normalState} />
            <div className="space-y-2">
              {filteredNormal.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
                  <p className="text-xs text-brand-text-light">Sin tareas</p>
                  {tab === 'all' && isAdmin && <button onClick={() => setShowModal(true)} className="mt-2 btn-ghost text-xs py-1"><Plus size={12} /> Nueva</button>}
                </div>
              ) : filteredNormal.map((task) => (
                <TaskCard key={task.id} task={task} users={users} onEdit={canEdit(task) ? handleEdit : null} onComplete={handleComplete} />
              ))}
            </div>
          </div>

          {/* Columna Recurrentes */}
          <div>
            <ColumnHeader title="Recurrentes" icon={RefreshCw} iconColor="text-blue-500" count={filteredRecurring.length} {...recurringState} />
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

          {/* Columna Supervisión */}
          <div>
            <ColumnHeader title="Supervisión" icon={Eye} iconColor="text-amber-500" count={filteredSupervision.length} {...supervisionState} />
            <div className="space-y-2">
              {filteredSupervision.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
                  <p className="text-xs text-brand-text-light">Sin tareas a supervisar</p>
                </div>
              ) : filteredSupervision.map((task) => (
                <div key={task.id}>
                  <TaskCard task={task} users={users} onEdit={isAdmin ? handleEdit : null}
                    onComplete={task.status === 'pending_response' ? handleVerify : null} />
                  {task.status === 'pending_response' && (
                    <button onClick={() => handleVerify(task)}
                      className="w-full mt-1 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                      ✓ Verificar y cerrar tarea
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
