import { useState, useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import TaskCard from '../components/tasks/TaskCard'
import TaskFilters from '../components/tasks/TaskFilters'
import TaskModal from '../components/tasks/TaskModal'
import EmptyState from '../components/ui/EmptyState'
import { useUsers } from '../hooks/useUsers'
import { PRIORITIES } from '../utils/constants'
import { CheckSquare, Plus, RefreshCw, ChevronDown } from 'lucide-react'
import { isToday, isThisWeek, isThisMonth, isThisYear, isBefore, startOfDay } from 'date-fns'
import { updateTask, completeAndRecur } from '../services/tasks'
import toast from 'react-hot-toast'
import Avatar from '../components/ui/Avatar'

const TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'today', label: 'Hoy' },
  { key: 'weekly', label: 'Semanales' },
  { key: 'monthly', label: 'Mensuales' },
  { key: 'annual', label: 'Anuales' },
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
    case 'annual': return tasks.filter((t) => t.status !== 'done' && (t.recurrence === 'annual' || (t.dueDate && isThisYear(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate)))))
    case 'done': return tasks.filter((t) => t.status === 'done')
    default: return tasks.filter((t) => t.status !== 'done')
  }
}

function applyFilters(tasks, filters) {
  let result = [...tasks]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
  }
  if (filters.priority) result = result.filter((t) => t.priority === filters.priority)
  if (filters.status) result = result.filter((t) => t.status === filters.status)
  result.sort((a, b) => {
    switch (filters.sort) {
      case 'priority': return (PRIORITIES[a.priority]?.order || 9) - (PRIORITIES[b.priority]?.order || 9)
      case 'dueDate': {
        const da = a.dueDate?.toDate ? a.dueDate.toDate() : a.dueDate ? new Date(a.dueDate) : new Date('9999')
        const db = b.dueDate?.toDate ? b.dueDate.toDate() : b.dueDate ? new Date(b.dueDate) : new Date('9999')
        return da - db
      }
      case 'status': return (a.status || '').localeCompare(b.status || '')
      case 'title': return a.title.localeCompare(b.title)
      default: return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    }
  })
  return result
}

export default function Tasks() {
  const { myTasks, allTasks } = useTasks()
  const { currentUser, userProfile } = useAuth()
  const { users } = useUsers()
  const isAdmin = userProfile?.role === 'admin'

  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [filters, setFilters] = useState({ search: '', priority: '', status: '', sort: 'priority' })
  const [selectedEmployee, setSelectedEmployee] = useState('all') // admin filter

  // Admin ve todas las tareas filtradas por empleado; empleado ve solo las suyas
  const source = useMemo(() => {
    if (!isAdmin) return myTasks
    if (selectedEmployee === 'all') return allTasks
    return allTasks.filter((t) => t.assignedTo === selectedEmployee || t.verifiedBy === selectedEmployee)
  }, [isAdmin, allTasks, myTasks, selectedEmployee])

  const tabFiltered = useMemo(() => filterByTab(source, tab), [source, tab])
  const tasks = useMemo(() => applyFilters(tabFiltered, filters), [tabFiltered, filters])

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

  const selectedUser = users.find((u) => u.uid === selectedEmployee)

  return (
    <div>
      <Header
        title={isAdmin ? 'Tareas del equipo' : 'Mis tareas'}
        action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }}
      />
      <div className="px-4 lg:px-6 py-5 space-y-4 max-w-4xl">

        {/* Admin: filtro por empleado */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-brand-text-muted font-medium">Ver tareas de:</span>
            <button onClick={() => setSelectedEmployee('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedEmployee === 'all' ? 'bg-brand-dark text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:bg-brand-bg-3'}`}>
              Todo el equipo
            </button>
            {users.map((u) => (
              <button key={u.uid} onClick={() => setSelectedEmployee(u.uid)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedEmployee === u.uid ? 'bg-brand-dark text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:bg-brand-bg-3'}`}>
                <Avatar name={u.displayName} size="xs" />
                {u.displayName?.split(' ')[0] || u.email}
                {u.uid === currentUser?.uid && <span className="opacity-60">(yo)</span>}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => {
            const count = filterByTab(source, key).length
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${tab === key ? 'bg-brand-dark text-white' : 'bg-brand-bg-2 text-brand-text-muted hover:text-brand-text hover:bg-brand-bg-3'}`}>
                {label}
                {count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab === key ? 'bg-white/20 text-white' : 'bg-brand-border text-brand-text-muted'}`}>{count}</span>}
              </button>
            )
          })}
        </div>

        <TaskFilters filters={filters} onChange={setFilters} />

        {tasks.length === 0 ? (
          <EmptyState
            icon={tab === 'done' ? CheckSquare : RefreshCw}
            title={filters.search || filters.priority || filters.status ? 'Sin resultados' : 'Sin tareas en esta vista'}
            description={tab === 'done' ? 'Las completadas aparecerán aquí.' : 'Crea una nueva tarea para empezar.'}
            action={!filters.search && !filters.priority && !filters.status && isAdmin ? (
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm"><Plus size={15} /> Nueva tarea</button>
            ) : null}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task) => (
              <div key={task.id}>
                {task.isVerifierTask && !isAdmin && (
                  <div className="flex items-center gap-1 mb-1 px-1">
                    <span className="text-xs text-amber-600 font-semibold">👁 Para supervisar</span>
                  </div>
                )}
                <TaskCard task={task} users={users} onEdit={isAdmin || task.assignedTo === currentUser?.uid ? handleEdit : null} onComplete={handleComplete} />
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
