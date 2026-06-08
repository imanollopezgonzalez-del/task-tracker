import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskModal from '../components/tasks/TaskModal'
import EmptyState from '../components/ui/EmptyState'
import { useUsers } from '../hooks/useUsers'
import { PRIORITIES } from '../utils/constants'
import { CheckSquare, Plus, RefreshCw, Eye, ChevronDown } from 'lucide-react'
import { isToday, isThisWeek, isThisMonth, isThisYear, isBefore, startOfDay } from 'date-fns'
import { updateTask, completeAndRecur } from '../services/tasks'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'weekly', label: 'Semanales' },
  { key: 'monthly', label: 'Mensuales' },
  { key: 'done', label: 'Completadas' },
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

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITIES[a.priority]?.order || 9
    const pb = PRIORITIES[b.priority]?.order || 9
    return pa !== pb ? pa - pb : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  })
}

function TaskColumn({ title, icon: Icon, iconColor, tasks, users, onEdit, onComplete, emptyText }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center gap-2 mb-3 px-1`}>
        <Icon size={15} className={iconColor} />
        <span className="text-xs font-bold text-brand-text uppercase tracking-wide">{title}</span>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs bg-brand-bg-2 text-brand-text-muted px-2 py-0.5 rounded-full font-medium border border-brand-border">
            {tasks.length}
          </span>
        )}
      </div>
      <div className="space-y-2 flex-1">
        {tasks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-brand-border py-8 text-center">
            <p className="text-xs text-brand-text-light">{emptyText}</p>
          </div>
        ) : tasks.map((task) => (
          <TaskCard key={task.id} task={task} users={users} onEdit={onEdit} onComplete={onComplete} compact />
        ))}
      </div>
    </div>
  )
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

  // Para admin: elegir qué usuario ver (me = yo mismo)
  const viewUid = isAdmin
    ? (selectedUid === 'me' ? currentUser?.uid : selectedUid === 'all' ? null : selectedUid)
    : currentUser?.uid

  // Fuente de datos según rol y selección
  const source = useMemo(() => {
    if (!isAdmin) return myTasks
    if (selectedUid === 'all') return allTasks
    const uid = selectedUid === 'me' ? currentUser?.uid : selectedUid
    return allTasks.filter((t) => t.assignedTo === uid || t.verifiedBy === uid)
  }, [isAdmin, allTasks, myTasks, selectedUid, currentUser])

  const tabFiltered = useMemo(() => filterByTab(source, tab), [source, tab])

  // Separar en 3 columnas
  const { normalTasks, recurringTasks, supervisionTasks } = useMemo(() => {
    const uid = viewUid || ''
    const normal = []
    const recurring = []
    const supervision = []
    tabFiltered.forEach((t) => {
      const isVerifier = t.verifiedBy === uid && t.assignedTo !== uid
      if (isVerifier) {
        supervision.push(t)
      } else if (t.type === 'recurring') {
        recurring.push(t)
      } else {
        normal.push(t)
      }
    })
    return {
      normalTasks: sortTasks(normal),
      recurringTasks: sortTasks(recurring),
      supervisionTasks: sortTasks(supervision),
    }
  }, [tabFiltered, viewUid])

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

  const canEdit = (task) => isAdmin || task.assignedTo === currentUser?.uid

  const tabCounts = useMemo(() => Object.fromEntries(
    TABS.map(({ key }) => [key, filterByTab(source, key).length])
  ), [source])

  return (
    <div>
      <Header
        title={isAdmin ? 'Tareas del equipo' : 'Mis tareas'}
        action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }}
      />
      <div className="px-4 lg:px-6 py-5 space-y-4 max-w-6xl">

        {/* Admin: filtro desplegable */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-text-muted font-medium flex-shrink-0">Ver tareas de:</span>
            <div className="relative">
              <select
                value={selectedUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                className="select-field pr-8 py-1.5 text-sm pl-3 min-w-44 font-medium"
              >
                <option value="me">Mis tareas (yo)</option>
                <option value="all">Todo el equipo</option>
                {users.filter(u => u.uid !== currentUser?.uid).map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
        )}

        {/* Tabs de período */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${tab === key ? 'bg-brand-dark text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:text-brand-text hover:bg-brand-bg-3'}`}>
              {label}
              {tabCounts[key] > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === key ? 'bg-white/20 text-white' : 'bg-brand-border text-brand-text-muted'}`}>
                  {tabCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <TaskColumn
            title="Tareas"
            icon={CheckSquare}
            iconColor="text-brand-orange"
            tasks={normalTasks}
            users={users}
            onEdit={(t) => canEdit(t) ? handleEdit(t) : null}
            onComplete={handleComplete}
            emptyText="Sin tareas"
          />
          <TaskColumn
            title="Recurrentes"
            icon={RefreshCw}
            iconColor="text-blue-500"
            tasks={recurringTasks}
            users={users}
            onEdit={(t) => canEdit(t) ? handleEdit(t) : null}
            onComplete={handleComplete}
            emptyText="Sin tareas recurrentes"
          />
          <TaskColumn
            title="Supervisión"
            icon={Eye}
            iconColor="text-amber-500"
            tasks={supervisionTasks}
            users={users}
            onEdit={(t) => isAdmin ? handleEdit(t) : null}
            onComplete={handleComplete}
            emptyText="Sin tareas a supervisar"
          />
        </div>
      </div>

      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
