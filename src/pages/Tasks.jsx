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
import { CheckSquare, Plus, RefreshCw } from 'lucide-react'
import { isToday, isThisWeek, isThisMonth, isThisYear, isBefore, startOfDay } from 'date-fns'
import { updateTask, completeAndRecur } from '../services/tasks'
import toast from 'react-hot-toast'

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
    case 'weekly': return tasks.filter((t) => t.recurrence === 'weekly' || (t.dueDate && isThisWeek(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate), { weekStartsOn: 1 })))
    case 'monthly': return tasks.filter((t) => t.recurrence === 'monthly' || (t.dueDate && isThisMonth(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate))))
    case 'annual': return tasks.filter((t) => t.recurrence === 'annual' || (t.dueDate && isThisYear(t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate))))
    case 'done': return tasks.filter((t) => t.status === 'done')
    default: return tasks.filter((t) => t.status !== 'done')
  }
}

function applyFilters(tasks, filters) {
  let result = [...tasks]
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.tags?.some((tag) => tag.toLowerCase().includes(q)))
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

export default function Tasks({ showAll = false }) {
  const { myTasks, allTasks } = useTasks()
  const { currentUser } = useAuth()
  const { users } = useUsers()
  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [filters, setFilters] = useState({ search: '', priority: '', status: '', sort: 'priority' })

  const source = showAll ? allTasks : myTasks
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

  return (
    <div>
      <Header title={showAll ? 'Todas las tareas' : 'Mis tareas'} action={{ label: 'Nueva tarea', onClick: () => setShowModal(true) }} />
      <div className="px-4 lg:px-6 py-5 space-y-4 max-w-4xl">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
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

        {/* Filters */}
        <TaskFilters filters={filters} onChange={setFilters} />

        {/* Task list */}
        {tasks.length === 0 ? (
          <EmptyState
            icon={tab === 'done' ? CheckSquare : RefreshCw}
            title={filters.search || filters.priority || filters.status ? 'Sin resultados para esos filtros' : 'Sin tareas en esta vista'}
            description={tab === 'done' ? 'Las tareas completadas aparecerán aquí.' : 'Crea una nueva tarea para empezar.'}
            action={!filters.search && !filters.priority && !filters.status ? (
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
                <Plus size={15} /> Nueva tarea
              </button>
            ) : null}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} users={users} onEdit={handleEdit} onComplete={handleComplete} />
            ))}
          </div>
        )}
      </div>

      <TaskModal isOpen={showModal} onClose={handleClose} task={editTask} users={users} />
    </div>
  )
}
