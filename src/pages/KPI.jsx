import { useMemo } from 'react'
import { useTasks } from '../contexts/TaskContext'
import { useUsers } from '../hooks/useUsers'
import Header from '../components/layout/Header'
import { PRIORITIES, STATUSES } from '../utils/constants'
import { isThisWeek, isThisMonth, isThisYear, subDays, isAfter, format, startOfWeek, eachDayOfInterval, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import Avatar from '../components/ui/Avatar'

const COLORS = {
  urgent: '#DC2626',
  important: '#D97757',
  low: '#16A34A',
  not_started: '#94A3B8',
  in_progress: '#3B82F6',
  pending_response: '#F59E0B',
  pending_adjustments: '#F97316',
  done: '#22C55E',
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

const CUSTOM_TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-modal">
      <p className="text-xs font-semibold text-brand-text mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function KPI() {
  const { allTasks } = useTasks()
  const { users } = useUsers()

  const stats = useMemo(() => {
    const done = allTasks.filter((t) => t.status === 'done')
    const active = allTasks.filter((t) => t.status !== 'done')
    const withVerifier = allTasks.filter((t) => t.verifiedBy)
    const verifiedDone = done.filter((t) => t.verifiedBy)
    const pendingVerification = allTasks.filter((t) => t.status === 'pending_response' && t.verifiedBy)
    const thisWeek = done.filter((t) => t.completedAt && isThisWeek(t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt), { weekStartsOn: 1 }))
    const thisMonth = done.filter((t) => t.completedAt && isThisMonth(t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)))
    const thisYear = done.filter((t) => t.completedAt && isThisYear(t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)))
    const rate = allTasks.length ? Math.round((done.length / allTasks.length) * 100) : 0
    return { done, active, thisWeek, thisMonth, thisYear, rate, total: allTasks.length, withVerifier: withVerifier.length, verifiedDone: verifiedDone.length, pendingVerification: pendingVerification.length }
  }, [allTasks])

  const priorityData = useMemo(() => Object.entries(PRIORITIES).map(([k, v]) => ({
    name: v.label,
    total: allTasks.filter((t) => t.priority === k).length,
    completadas: allTasks.filter((t) => t.priority === k && t.status === 'done').length,
    fill: COLORS[k],
  })), [allTasks])

  const statusData = useMemo(() => Object.entries(STATUSES).map(([k, v]) => ({
    name: v.label,
    value: allTasks.filter((t) => t.status === k).length,
    fill: COLORS[k],
  })).filter((d) => d.value > 0), [allTasks])

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end }).map((day) => {
      const dayTasks = allTasks.filter((t) => {
        if (!t.completedAt) return false
        const d = t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)
        return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      })
      return { día: format(day, 'EEE', { locale: es }), completadas: dayTasks.length }
    })
  }, [allTasks])

  const last30days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const day = subDays(new Date(), 29 - i)
      const count = allTasks.filter((t) => {
        if (!t.completedAt) return false
        const d = t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt)
        return format(d, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      }).length
      return { fecha: format(day, 'dd/MM'), completadas: count }
    })
  }, [allTasks])

  const userStats = useMemo(() => users.map((u) => {
    const assigned = allTasks.filter((t) => t.assignedTo === u.uid)
    const done = assigned.filter((t) => t.status === 'done')
    const supervising = allTasks.filter((t) => t.verifiedBy === u.uid && t.assignedTo !== u.uid)
    const supervisedDone = supervising.filter((t) => t.status === 'done')
    const rate = assigned.length ? Math.round((done.length / assigned.length) * 100) : 0
    return { ...u, assigned: assigned.length, done: done.length, rate, supervising: supervising.length, supervisedDone: supervisedDone.length }
  }).sort((a, b) => b.done - a.done), [allTasks, users])

  return (
    <div>
      <Header title="KPIs & Métricas" />
      <div className="px-4 lg:px-6 py-5 space-y-6 max-w-4xl">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total tareas" value={stats.total} sub="en el sistema" />
          <KPICard label="Completadas" value={stats.done.length} sub="de todas" color="text-green-600" />
          <KPICard label="Tasa completado" value={`${stats.rate}%`} sub="del total" color={stats.rate >= 70 ? 'text-green-600' : stats.rate >= 40 ? 'text-amber-600' : 'text-red-600'} />
          <KPICard label="Esta semana" value={stats.thisWeek.length} sub="completadas" color="text-brand-orange" />
        </div>
        {/* Supervisión KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KPICard label="Con supervisión" value={stats.withVerifier} sub="tareas con verificador" />
          <KPICard label="Verificadas" value={stats.verifiedDone} sub="completadas + verificadas" color="text-emerald-600" />
          <KPICard label="Pend. verificar" value={stats.pendingVerification} sub="esperando confirmación" color="text-amber-600" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Este mes" value={stats.thisMonth.length} sub="completadas" />
          <KPICard label="Este año" value={stats.thisYear.length} sub="completadas" />
          <KPICard label="Activas" value={stats.active.length} sub="pendientes" color="text-blue-600" />
          <KPICard label="Urgentes activas" value={allTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length} sub="sin completar" color="text-red-600" />
        </div>

        {/* Priority bar chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Tareas por urgencia</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#78716C' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Bar dataKey="total" name="Total" fill="#E7E2DA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completadas" name="Completadas" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status pie */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-brand-text mb-4">Distribución de estados</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${value}`}>
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<CUSTOM_TOOLTIP />} />
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
                <Tooltip content={<CUSTOM_TOOLTIP />} />
                <Bar dataKey="completadas" name="Completadas" fill="#D97757" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 30 days trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-brand-text mb-4">Tendencia últimos 30 días</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={last30days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2DA" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#78716C' }} interval={6} />
              <YAxis tick={{ fontSize: 11, fill: '#78716C' }} allowDecimals={false} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Line type="monotone" dataKey="completadas" name="Completadas" stroke="#D97757" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User ranking */}
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
                    <span className="text-xs text-brand-text-muted">{u.done}/{u.assigned} · {u.rate}% · 👁{u.supervisedDone}/{u.supervising}</span>
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
