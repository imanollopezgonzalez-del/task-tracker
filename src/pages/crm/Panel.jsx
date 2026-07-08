import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import { subscribeObjetivos, setObjetivoMes } from '../../services/crmSettings'
import {
  LEAD_STAGES, CONTACTO_STAGES, ORIGENES_CONTACTO, TIPOS_CLIENTE,
  PRODUCTOS, RESPONSABLES, TIPO_CLIENTE_COLORS,
} from '../../utils/crmConstants'
import { getResponsables } from '../../utils/crmHelpers'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { format, subMonths, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { Settings2, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'

// Colores de pipeline de Leads (mismos tonos que los badges Tailwind, en hex para los charts)
const LEAD_STAGE_COLORS = {
  lead_nuevo: '#94A3B8', email: '#3B82F6', instagram: '#EC4899', linkedin: '#0284C7',
  whatsapp: '#22C55E', llamada: '#EAB308', no_contactado: '#F87171',
  reintentar_contacto: '#FB923C', closed: '#9CA3AF',
}

const MESES_NOMBRES = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

function isLead(l) { return !l.esCliente && (!l.registroTipo || l.registroTipo === 'lead') }
function isContacto(l) { return l.registroTipo === 'contacto' }
function isCliente(l) { return l.registroTipo === 'cliente' }

// Años disponibles para elegir: desde currentYear-4 hasta currentYear+1
function getAnoOptions() {
  const y = new Date().getFullYear()
  const opts = []
  for (let i = 1; i >= -4; i--) opts.push(String(y + i))
  return opts
}

function KPICard({ label, value, sub }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-brand-text-muted uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-3xl font-bold text-brand-text">{value}</p>
      {sub && <p className="text-xs text-brand-text-muted mt-1">{sub}</p>}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 shadow-modal">
      {label && <p className="text-xs font-semibold text-brand-text mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color || p.fill }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function ChartCard({ title, children, empty }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-3">{title}</p>
      {empty
        ? <div className="h-[220px] flex items-center justify-center text-xs text-brand-text-muted">Sin datos todavía</div>
        : <div style={{ width: '100%', height: 220 }}>{children}</div>
      }
    </div>
  )
}

// ── Modal de objetivos ──────────────────────────────────────────────────────────

function ObjetivosModal({ companyId, mesKey, mesLabel, objetivosMes, onClose }) {
  const [valores, setValores] = useState(() =>
    PRODUCTOS.reduce((acc, p) => ({ ...acc, [p]: objetivosMes?.[p] ?? '' }), {})
  )
  const [saving, setSaving] = useState(false)

  const handleGuardar = async () => {
    setSaving(true)
    try {
      for (const producto of PRODUCTOS) {
        const val = Number(valores[producto]) || 0
        await setObjetivoMes(companyId, mesKey, producto, val)
      }
      toast.success('Objetivos guardados')
      onClose()
    } catch (err) {
      toast.error('Error al guardar objetivos')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
          <h2 className="text-sm font-semibold text-brand-text capitalize">Objetivos de kg · {mesLabel}</h2>
          <button onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {PRODUCTOS.map((p) => (
            <div key={p}>
              <label className="label">{p}</label>
              <input
                className="input-field"
                type="number"
                min="0"
                value={valores[p]}
                onChange={(e) => setValores((v) => ({ ...v, [p]: e.target.value }))}
                placeholder="Kg objetivo"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-brand-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleGuardar} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Panel() {
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role === 'admin'
  const [leads, setLeads] = useState([])
  const [objetivos, setObjetivos] = useState({})
  const [showObjetivosModal, setShowObjetivosModal] = useState(false)

  const anoActualStr = String(new Date().getFullYear())
  const mesActualStr = format(new Date(), 'MM')

  // Filtros globales del panel
  const [search, setSearch] = useState('')
  const [filterResponsable, setFilterResponsable] = useState('')
  const [filterAno, setFilterAno] = useState(anoActualStr)
  const [filterMes, setFilterMes] = useState('')

  // Mes/año propios del widget de Objetivo (independientes de los filtros globales,
  // siempre apuntan a un mes puntual — nunca "Todos")
  const [objAno, setObjAno] = useState(anoActualStr)
  const [objMes, setObjMes] = useState(mesActualStr)

  const anoOptions = useMemo(() => getAnoOptions(), [])

  useEffect(() => {
    if (!userProfile?.companyId) return
    const unsub = subscribeLeads(userProfile.companyId, setLeads)
    return unsub
  }, [userProfile?.companyId])

  useEffect(() => {
    if (!userProfile?.companyId) return
    const unsub = subscribeObjetivos(userProfile.companyId, setObjetivos)
    return unsub
  }, [userProfile?.companyId])

  // Filtro por empresa + vendedor: aplica a todos los widgets
  const leadsBase = useMemo(() => leads.filter((l) => {
    if (search && !l.nombre?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterResponsable && !getResponsables(l).includes(filterResponsable)) return false
    return true
  }), [leads, search, filterResponsable])

  // + filtro por mes/año (fecha de cierre para clientes, fecha de creación para el resto)
  const leadsFiltrados = useMemo(() => {
    if (!filterAno && !filterMes) return leadsBase
    return leadsBase.filter((l) => {
      const dateStr = l.registroTipo === 'cliente' ? l.fechaCierre : null
      const fecha = dateStr
        ? new Date(dateStr + 'T12:00:00')
        : (l.createdAt?.toDate ? l.createdAt.toDate() : null)
      if (!fecha) return false
      if (filterAno && String(fecha.getFullYear()) !== filterAno) return false
      if (filterMes && format(fecha, 'MM') !== filterMes) return false
      return true
    })
  }, [leadsBase, filterAno, filterMes])

  const soloLeads = useMemo(() => leadsFiltrados.filter(isLead), [leadsFiltrados])
  const contactos = useMemo(() => leadsFiltrados.filter(isContacto), [leadsFiltrados])
  const clientes = useMemo(() => leadsFiltrados.filter(isCliente), [leadsFiltrados])
  const clientesActivos = useMemo(() => clientes.filter((c) => c.clienteEstado !== 'perdido'), [clientes])

  // Base para Objetivo de kg y Kilos-por-mes: solo empresa + vendedor (tienen su propia lógica de fechas)
  const clientesBase = useMemo(() => leadsBase.filter(isCliente), [leadsBase])

  // Widget: estado de leads
  const estadoLeadsData = useMemo(() => Object.entries(LEAD_STAGES).map(([k, v]) => ({
    name: v.label,
    value: soloLeads.filter((l) => l.estado === k).length,
    fill: LEAD_STAGE_COLORS[k] || '#94A3B8',
  })).filter((d) => d.value > 0), [soloLeads])

  // Widget: leads por origen
  const leadsPorOrigenData = useMemo(() => ORIGENES_CONTACTO.map((o) => ({
    name: o.label,
    value: soloLeads.filter((l) => (l.origenContacto || l.grupo) === o.key).length,
    fill: o.color,
  })).filter((d) => d.value > 0), [soloLeads])

  // Widget: distribución de contactos
  const contactosData = useMemo(() => Object.entries(CONTACTO_STAGES)
    .filter(([k]) => k !== 'ganado' && k !== 'perdido')
    .map(([k, v]) => ({
      name: v.label,
      value: contactos.filter((c) => (c.estadoContacto || 'contactado') === k).length,
      fill: v.kanban,
    })).filter((d) => d.value > 0), [contactos])

  // Widget: objetivo de kg del mes/año elegidos en el propio widget
  const mesKey = `${objAno}-${objMes}`
  const mesLabel = format(new Date(`${mesKey}-01T12:00:00`), 'MMMM yyyy', { locale: es })
  const objetivosMes = objetivos[mesKey] || {}
  const mesFin = useMemo(() => endOfMonth(new Date(`${mesKey}-01T12:00:00`)), [mesKey])

  const clientesActivosEnMes = useMemo(() => clientesBase.filter((c) => {
    if (!c.fechaCierre) return false
    const cierre = new Date(c.fechaCierre + 'T12:00:00')
    if (cierre > mesFin) return false
    if (c.clienteEstado === 'perdido' && c.fechaPerdido) {
      const perdido = new Date(c.fechaPerdido + 'T12:00:00')
      if (perdido <= mesFin) return false
    }
    return true
  }), [clientesBase, mesFin])

  const kgPorProductoMes = useMemo(() => PRODUCTOS.reduce((acc, p) => {
    acc[p] = clientesActivosEnMes
      .filter((c) => c.producto === p)
      .reduce((sum, c) => sum + (Number(c.kilosMensuales) || 0), 0)
    return acc
  }, {}), [clientesActivosEnMes])

  // Widget: clientes por vendedor
  const clientesPorVendedorData = useMemo(() => RESPONSABLES.map((r) => ({
    name: r,
    value: clientesActivos.filter((c) => getResponsables(c).includes(r)).length,
  })).filter((d) => d.value > 0), [clientesActivos])

  // Widget: kilos por mes por tipo — 12 meses del año elegido en los filtros globales
  // (o los últimos 12 meses corridos si el filtro de año está en "Todos")
  const kgPorMesTipoData = useMemo(() => {
    const meses = filterAno
      ? Array.from({ length: 12 }, (_, i) => new Date(Number(filterAno), i, 1))
      : Array.from({ length: 12 }, (_, i) => subMonths(new Date(), 11 - i))
    return meses.map((mes) => {
      const fin = endOfMonth(mes)
      const row = { mes: format(mes, 'MMM yy', { locale: es }) }
      TIPOS_CLIENTE.forEach((tipo) => {
        row[tipo] = clientesBase
          .filter((c) => {
            if (c.tipoCliente !== tipo || !c.fechaCierre) return false
            const cierre = new Date(c.fechaCierre + 'T12:00:00')
            if (cierre > fin) return false
            if (c.clienteEstado === 'perdido' && c.fechaPerdido) {
              const perdido = new Date(c.fechaPerdido + 'T12:00:00')
              if (perdido <= fin) return false
            }
            return true
          })
          .reduce((sum, c) => sum + (Number(c.kilosMensuales) || 0), 0)
      })
      return row
    })
  }, [clientesBase, filterAno])

  // Widget: tipos entre clientes nuevos (según el alcance de los filtros globales)
  const tiposNuevosData = useMemo(() => TIPOS_CLIENTE.map((t) => ({
    name: t,
    value: clientesActivos.filter((c) => c.tipoCliente === t).length,
    fill: TIPO_CLIENTE_COLORS[t] || '#94A3B8',
  })).filter((d) => d.value > 0), [clientesActivos])

  const clearFilters = () => {
    setSearch(''); setFilterResponsable(''); setFilterAno(''); setFilterMes('')
  }
  const hasActiveFilters = search || filterResponsable || filterAno || filterMes

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-brand-border bg-white flex-shrink-0">
        <h1 className="text-lg font-bold text-brand-text">Panel de ventas</h1>
        <p className="text-xs text-brand-text-muted mt-0.5">Resumen del pipeline de Leads, Contactos y Clientes</p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-light" />
            <input
              className="input-field pl-8 h-8 text-xs w-48"
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select-field h-8 text-xs w-44" value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)}>
            <option value="">Vendedor</option>
            {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="select-field h-8 text-xs w-28" value={filterAno} onChange={(e) => setFilterAno(e.target.value)}>
            <option value="">Año: todos</option>
            {anoOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="select-field h-8 text-xs w-36" value={filterMes} onChange={(e) => setFilterMes(e.target.value)}>
            <option value="">Mes: todos</option>
            {MESES_NOMBRES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-brand-text-muted hover:text-brand-text underline">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
        {/* Totales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard label="Leads" value={soloLeads.length} />
          <KPICard label="Contactos" value={contactos.length} />
          <KPICard label="Clientes activos" value={clientesActivos.length} sub={`${clientes.length - clientesActivos.length} perdido${clientes.length - clientesActivos.length !== 1 ? 's' : ''}`} />
        </div>

        {/* Objetivo de kg */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Objetivo de kg mensual</p>
            <div className="flex items-center gap-2">
              <select className="select-field h-8 text-xs w-32" value={objMes} onChange={(e) => setObjMes(e.target.value)}>
                {MESES_NOMBRES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className="select-field h-8 text-xs w-24" value={objAno} onChange={(e) => setObjAno(e.target.value)}>
                {anoOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {isAdmin && (
                <button onClick={() => setShowObjetivosModal(true)} className="btn-ghost p-1.5" title="Editar objetivos">
                  <Settings2 size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {PRODUCTOS.map((p) => {
              const actual = kgPorProductoMes[p] || 0
              const objetivo = Number(objetivosMes[p]) || 0
              const diff = actual - objetivo
              const pct = objetivo > 0 ? Math.round((actual / objetivo) * 100) : 0
              const pctVisual = Math.min(100, Math.max(0, pct))
              return (
                <div key={p}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-brand-text">{p}</span>
                    <span className="text-xs text-brand-text-muted">
                      {actual} / {objetivo > 0 ? objetivo : '—'} kg{objetivo > 0 && ` · ${pct}%`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-brand-bg-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${objetivo > 0 && diff >= 0 ? 'bg-green-500' : 'bg-brand-orange'}`}
                      style={{ width: `${pctVisual}%` }}
                    />
                  </div>
                  {objetivo > 0 && (
                    <p className={`text-xs mt-1 font-medium ${diff >= 0 ? 'text-green-700' : 'text-brand-text-muted'}`}>
                      {diff >= 0
                        ? `+${diff} kg por encima del objetivo`
                        : `Faltan ${Math.abs(diff)} kg (${100 - pct}%) para llegar al objetivo`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Estado de leads" empty={estadoLeadsData.length === 0}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={estadoLeadsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {estadoLeadsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Leads por origen" empty={leadsPorOrigenData.length === 0}>
            <ResponsiveContainer>
              <BarChart data={leadsPorOrigenData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Leads" radius={[4, 4, 0, 0]}>
                  {leadsPorOrigenData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribución de contactos" empty={contactosData.length === 0}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={contactosData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {contactosData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Clientes por vendedor" empty={clientesPorVendedorData.length === 0}>
            <ResponsiveContainer>
              <BarChart data={clientesPorVendedorData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Clientes" fill="#D97757" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Tipos de clientes nuevos" empty={tiposNuevosData.length === 0}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={tiposNuevosData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {tiposNuevosData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={`Kilos por mes por tipo de cliente ${filterAno ? `(${filterAno})` : '(últimos 12 meses)'}`} empty={clientesBase.length === 0}>
            <ResponsiveContainer>
              <BarChart data={kgPorMesTipoData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                {TIPOS_CLIENTE.map((tipo) => (
                  <Bar key={tipo} dataKey={tipo} name={tipo} stackId="kg" fill={TIPO_CLIENTE_COLORS[tipo] || '#94A3B8'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {showObjetivosModal && (
        <ObjetivosModal
          companyId={userProfile.companyId}
          mesKey={mesKey}
          mesLabel={mesLabel}
          objetivosMes={objetivosMes}
          onClose={() => setShowObjetivosModal(false)}
        />
      )}
    </div>
  )
}
