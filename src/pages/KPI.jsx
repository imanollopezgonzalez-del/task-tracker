import { useMemo, useState } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useUsers } from '../hooks/useUsers'
import Header from '../components/layout/Header'
import { PRIORITIES, STATUSES } from '../utils/constants'
import {
  isThisWeek, isThisMonth, isThisYear, subDays, format,
  startOfWeek, eachDayOfInterval, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subYears, isWithinInterval, getMonth, getYear,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import Avatar from '../components/ui/Avatar'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'

const COLORS = {
  urgent: '#DC2626', important: '#D97757', low: '#16A34A',
  not_started: '#94A3B8', in_progress: '#3B82F6', pending_response: '#F59E0B',
  pending_adjustments: '#F97316', done: '#22C55E',
}

function KPICard({ label, value, sub, color = 'text-brand-text' }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-brand-text-muted uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-brand-text-muted mt-1">{sub}</p>}
    </div>
  )
}

const TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-modal">
      <p className="text-xs font-semibold text-brand-text mb-1">{label}</p>
      {payload.map((p) => <p key={p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

// Genera opciones de mes: últimos 12 meses
function getMonthOptions() {
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i)
    opts.push({ value: `month-${format(d, 'yyyy-MM')}`, label: format(d, 'MMMM yyyy', { locale: es }) })
  }
  return opts
}

function getYearOptions() {
  const year = getYear(new Date())
  return [
    { value: `year-${year}`, label: `${year}` },
    { value: `year-${year - 1}`, label: `${year - 1}` },
    { value: `year-${year - 2}`, label: `${year - 2}` },
  ]
}

function getDateRange(period) {
  if (!period || period === 'all') return null
  const now = new Date()
  if (period === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
  if (period === 'prev-month') { const m = subMonths(now, 1); return { start: startOfMonth(m), end: endOfMonth(m) } }
  if (period === 'year') return { start: startOfYear(now), end: endOfYear(now) }
  if (period === 'prev-year') { const y = subYears(now, 1); return { start: startOfYear(y), end: endOfYear(y) } }
  if (period.startsWith('month-')) {
    const [, ym] = period.split('month-')
    const d = new Date(ym + '-01')
    return { start: startOfMonth(d), end: endOfMonth(d) }
  }
  if (period.startsWith('year-')) {
    const [, y] = period.split('year-')
    const d = new Date(`${y}-01-01`)
    return { start: startOfYear(d), end: endOfYear(d) }
  }
  return null
}

function taskDate(task) {
  const d = task.dueDate || task.createdAt
  return d?.toDate ? d.toDate() : d ? new Date(d) : null
}

export default function KPI() {
  const { allTasks } = useTasks()
  const { users } = useUsers()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fPeriod, setFPeriod] = useState('all')
  const [fUser, setFUser] = useState('all')
  const [fPriority, setFPriority] = useState('all')
  const [fStatus, setFStatus] = useState('all')

  const activeFilters = [fPeriod !== 'all', fUser !== 'all', fPriority !== 'all', fStatus !== 'all'].filter(Boolean).length
  const clearFilters = () => { setFPeriod('all'); setFUser('all'); setFPriority('all'); setFStatus('all') }

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks]
    const range = getDateRange(fPeriod)
    if (range) tasks = tasks.filter((t) => { const d = taskDate(t); return d && isWithinInterval(d, range) })
    if (fUser !== 'all') tasks = tasks.filter((t) => t.assignedTo === fUser || t.verifiedBy === fUser)
    if (fPriority !== 'all') tasks = tasks.filter((t) => t.priority === fPriority)
    if (fStatus !== 'all') tasks = tasks.filter((t) => t.status === fStatus)
    return tasks
  }, [allTasks, fPeriod, fUser, fPriority, fStatus])

  const stats = useMemo(() => {
    const done = filteredTasks.filter((t) => t.status === 'done')
    const active = filteredTasks.filter((t) => t.status !== 'done')
    const withVerifier = filteredTasks.filter((t) => t.verifiedBy)
    const verifiedDone = done.filter((t) => t.verifiedBy)
    const pendingVerification = filteredTasks.filter((t) => t.status === 'pending_response' && t.verifiedBy)
    const thisWeek = done.filter((t) => { const d = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt ? new Date(t.completedAt) : null; return d && isThisWeek(d, { weekStartsOn: 1 }) })
    const thisMonth = done.filter((t) => { const d = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt ? new Date(t.completedAt) : null; return d && isThisMonth(d) })
    const thisYear = done.filter((t) => { const d = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt ? new Date(t.completedAt) : null; return d && isThisYear(d) })
    const rate = filteredTasks.length ? Math.round((done.length / filteredTasks.length) * 100) : 0
    return { done, active, thisWeek, thisMonth, thisYear, rate, total: filteredTasks.length, withVerifier: withVerifier.length, verifiedDone: verifiedDone.length, pendingVerification: pendingVerification.length }
  }, [filteredTasks])

  const priorityData = useMemo(() => Object.entries(PRIORITIES).map(([k, v]) => ({
    name: v.label,
    total: filteredTasks.filter((t) => t.priority === k).length,
    completadas: filteredTasks.filter((t) => t.priority === k && t.status === 'done').length,
    fill: COLORS[k],
  })), [filteredTasks])

  const statusData = useMemo(() => Object.entries(STATUSES).map(([k, v]) => ({
    name: v.label, value: filteredTasks.filter((t) => t.status === k).length, fill: COLORS[k],
  })).filter((d) => d.value > 0), [filteredTasks])

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end }).map((day) => ({
      día: format(day, 'EEE', { locale: es }),
      completadas: allTasks.filter((t) => {
        if (!t.completedAt) return false
        const d = t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)
        return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      }).length,
    }))
  }, [allTasks])

  const last30days = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const day = subDays(new Date(), 29 - i)
    return {
      fecha: format(day, 'dd/MM'),
      completadas: allTasks.filter((t) => {
        if (!t.completedAt) return false
        const d = t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)
        return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      }).length,
    }
  }), [allTasks])

  // Datos mes a mes (últimos 12 meses)
  const monthlyData = useMemo(() => getMonthOptions().reverse().map(({ label, value }) => {
    const range = getDateRange(value)
    if (!range) return { mes: label.slice(0, 3), completadas: 0, creadas: 0 }
    const created = allTasks.filter((t) => { const d = t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt ? new Date(t.createdAt) : null; return d && isWithinInterval(d, range) })
    const completed = allTasks.filter((t) => { const d = t.completedAt?.toDate ? t.completedAt.toDate() : t.completedAt ? new Date(t.completedAt) : null; return d && isWithinInterval(d, range) })
    return { mes: format(new Date(value.replace('month-', '') + '-01'), 'MMM yy', { locale: es }), completadas: completed.length, creadas: created.length }
  }), [allTasks])

  const userStats = useMemo(() => users.map((u) => {
    const assigned = filteredTasks.filter((t) => t.assignedTo === u.uid)
    const done = assigned.filter((t) => t.status === 'done')
    const supervising = filteredTasks.filter((t) => t.verifiedBy === u.uid && t.assignedTo !== u.uid)
    const supervisedDone = supervising.filter((t) => t.status === 'done')
    const rate = assigned.length ? Math.round((done.length / assigned.length) * 100) : 0
    return { ...u, assigned: assigned.length, done: done.length, rate, supervising: supervising.length, supervisedDone: supervisedDone.length }
  }).sort((a, b) => b.done - a.done), [filteredTasks, users])

  const monthOptions = getMonthOptions()
  const yearOptions = getYearOptions()

  return (
    <div>
      <Header title="KPIs & Métricas" />
      <div className="px-4 lg:px-6 py-5 space-y-5 max-w-4xl">

        {/* Filter bar */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-brand-orange" />
              <span className="text-sm font-semibold text-brand-text">Filtros</span>
              {activeFilters > 0 && <span className="px-2 py-0.5 text-xs bg-brand-orange text-white rounded-full font-medium">{activeFilters}</span>}
            </div>
            <div className="flex items-center gap-2">
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="text-xs text-brand-text-muted hover:text-brand-text flex items-center gap-1">
                  <X size={12} /> Limpiar
                </button>
              )}
              <button onClick={() => setFiltersOpen(!filtersOpen)} className="btn-ghost py-1.5 text-xs">
                {filtersOpen ? 'Cerrar' : 'Mostrar filtros'}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-brand-border animate-fade-in">
              {/* Período */}
              <div>
                <label className="label">Período</label>
                <div className="relative">
                  <select className="select-field pr-8 text-xs" value={fPeriod} onChange={(e) => setFPeriod(e.target.value)}>
                    <option value="all">Todos los tiempos</option>
                    <option value="week">Esta semana</option>
                    <option value="month">Este mes</option>
                    <option value="prev-month">Mes anterior</option>
                    <option value="year">Este año</option>
                    <option value="prev-year">Año anterior</option>
                    <optgroup label="─ Por mes ─">
                      {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                    <optgroup label="─ Por año ─">
                      {yearOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </optgroup>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Persona */}
              <div>
                <label className="label">Persona</label>
                <div className="relative">
                  <select className="select-field pr-8 text-xs" value={fUser} onChange={(e) => setFUser(e.target.value)}>
                    <option value="all">Todos</option>
                    {users.map((u) => <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Urgencia */}
              <div>
                <label className="label">Urgencia</label>
                <div className="relative">
                  <select className="select-field pr-8 text-xs" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
                    <option value="all">Todas</option>
                    <option value="urgent">Urgente</option>
                    <option value="important">Importante</option>
                    <option value="low">No urgente</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="label">Estado</label>
                <div className="relative">
                  <select className="select-field pr-8 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                    <option value="all">Todos</option>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilters > 0 && !filtersOpen && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-brand-border">
              {fPeriod !== 'all' && <span className="badge bg-brand-orange-light text-brand-orange border border-brand-orange/20 text-xs">{monthOptions.find(o => o.value === fPeriod)?.label || fPeriod}</span>}
              {fUser !== 'all' && <span className="badge bg-brand-orange-light text-brand-orange border border-brand-orange/20 text-xs">{users.find(u => u.uid === fUser)?.displayName || 'Usuario'}</span>}
              {fPriority !== 'all' && <span className="badge bg-brand-orange-light text-brand-orange border border-brand-orange/20 text-xs">{{urgent:'Urgente',important:'Importante',low:'No urgente'}[fPriority]}</span>}
              {fStatus !== 'all' && <span className="badge bg-brand-orange-light text-brand-orange border border-brand-orange/20 text-xs">{STATUSES[fStatus]?.label}</span>}
            </div>
          )}
        </div>

        {/* Main KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total tareas" value={stats.total} sub={activeFilters > 0 ? 'con filtros activos' : 'en el sistema'} />
          <KPICard label="Completadas" value={stats.done.length} sub={`${stats.rate}% del total`} color="text-green-600" />
          <KPICard label="Activas" value={stats.active.length} sub="pendientes" color="text-blue-600" />
          <KPICard label="Esta semana" value={stats.thisWeek.length} sub="completadas" color="text-brand-orange" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Este mes" value={stats.thisMonth.length} sub="completadas" />
          <KPICard label="Este año" value={stats.thisYear.length} sub="completadas" />
          <KPICard label="Urgentes activas" value={filteredTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length} sub="sin completar" color="text-red-600" />
          <KPICard label="Tasa completado" value={`${stats.rate}%`} color={stats.rate >= 70 ? 'text-green-600' : stats.rate >= 40 ? 'text-amber-600' : 'text-red-600'} />
        </div>

        {/* Supervisión */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard label="Con supervisión" value={stats.withVerifier} sub="tienen verificador" />
          <KPICard label="Verificadas" value={stats.verifiedDone} sub="completadas + verificadas" color="text-emerald-600" />
          <KPICard label="Pend. verificar" value={stats.pendingVerification} sub="esperando confirmación" color="text-amber-600" />
        </div>

        {/* Priority chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Tareas por urgencia</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip content={<TOOLTIP />} />
              <Bar dataKey="total" name="Total" fill="#E7E2DA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completadas" name="Completadas" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status pie */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-brand-text mb-4">Estados</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ value }) => value}>
                  {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip content={<TOOLTIP />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#78716C' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Week bar */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-brand-text mb-4">Completadas esta semana</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekDays}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
                <XAxis dataKey="día" tick={{ fontSize: 11, fill: '#78716C' }} />
                <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
                <Tooltip content={<TOOLTIP />} />
                <Bar dataKey="completadas" name="Completadas" fill="#D97757" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mes a mes — últimos 12 meses */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Evolución mes a mes</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip content={<TOOLTIP />} />
              <Bar dataKey="creadas" name="Creadas" fill="#E7E2DA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completadas" name="Completadas" fill="#D97757" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 30 days trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Tendencia últimos 30 días</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={last30days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#78716C' }} interval={6} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip content={<TOOLTIP />} />
              <Line type="monotone" dataKey="completadas" name="Completadas" stroke="#D97757" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Team ranking */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Rendimiento del equipo</h3>
          <div className="space-y-3">
            {userStats.map((u, i) => (
              <div key={u.uid} className="flex items-center gap-3">
                <span className="text-xs text-brand-text-muted w-4 text-right">{i + 1}</span>
                <Avatar name={u.displayName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-brand-text truncate">{u.displayName || u.email}</span>
                    <span className="text-xs text-brand-text-muted">{u.done}/{u.assigned} · {u.rate}% · 👁 {u.supervisedDone}/{u.supervising}</span>
                  </div>
                  <div className="w-full bg-brand-bg-2 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-brand-orange transition-all" style={{ width: `${u.rate}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {userStats.length === 0 && <p className="text-xs text-brand-text-muted text-center py-4">Sin datos de equipo</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
