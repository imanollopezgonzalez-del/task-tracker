import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useUsers } from '../../hooks/useUsers'
import { subscribeLeads, updateLead } from '../../services/leads'
import { createSeguimientoTask } from '../../services/tasks'
import { TIPOS_CLIENTE, PRODUCTOS, RESPONSABLES, TIPO_CLIENTE_COLORS } from '../../utils/crmConstants'
import { getResponsables } from '../../utils/crmHelpers'

const currentYear = new Date().getFullYear()

function getAnoAlta(c) {
  if (c.anoAlta) return c.anoAlta
  if (c.fechaCierre) return new Date(c.fechaCierre + 'T12:00:00').getFullYear()
  return currentYear
}

function getSeguimientoStatus(c) {
  if (!c.proximoSeguimiento) return 'pendiente'
  return new Date(c.proximoSeguimiento + 'T12:00:00') > new Date() ? 'contactado' : 'pendiente'
}

function fmtFecha(str) {
  if (!str) return '—'
  return new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtFechaHora(timestamp) {
  if (!timestamp?.toDate) return '—'
  return timestamp.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Badges ────────────────────────────────────────────────────────────────────

function TipoBadge({ tipo }) {
  if (!tipo) return <span className="text-xs text-brand-text-muted">—</span>
  return (
    <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium whitespace-nowrap"
      style={{ backgroundColor: TIPO_CLIENTE_COLORS[tipo] || '#94A3B8' }}>
      {tipo}
    </span>
  )
}

function ProductoBadge({ producto }) {
  if (!producto) return <span className="text-xs text-brand-text-muted">—</span>
  return (
    <span className={`badge text-xs ${producto === 'Pastas Pariggi'
      ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
      : 'bg-orange-50 text-brand-orange border border-orange-200'}`}>
      {producto}
    </span>
  )
}

function SeguimientoBadge({ status }) {
  if (status === 'contactado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        Contactado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
      Pendiente
    </span>
  )
}

// ── Table rows ────────────────────────────────────────────────────────────────

function TableRow({ c, onClick }) {
  const seg = getSeguimientoStatus(c)
  const primerContacto = c.contactos?.[0]
  const primerEmail = primerContacto?.emails?.[0] || c.email || ''

  return (
    <tr onClick={onClick} className="border-b border-brand-border hover:bg-brand-bg-2 cursor-pointer transition-colors">
      <td className="py-2.5 px-4 text-sm font-medium text-brand-text">{c.nombre || '—'}</td>
      <td className="py-2.5 px-4"><TipoBadge tipo={c.tipoCliente} /></td>
      <td className="py-2.5 px-4"><ProductoBadge producto={c.producto} /></td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{c.kilosMensuales ? `${c.kilosMensuales} kg` : '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{c.listaPrecios || '—'}</td>
      <td className="py-2.5 px-4"><SeguimientoBadge status={seg} /></td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{primerContacto?.nombre || c.personaContacto || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{primerContacto?.puesto || c.puesto || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{primerContacto?.telefono || c.telefono || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted truncate max-w-[140px]">{primerEmail || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{c.ubicacion || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{getResponsables(c).join(', ') || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{c.origenContacto || '—'}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted whitespace-nowrap">{fmtFecha(c.fechaCierre)}</td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted whitespace-nowrap">{fmtFechaHora(c.updatedAt)}</td>
    </tr>
  )
}

function GroupHeaderRow({ title, count, open, onToggle, color }) {
  return (
    <tr
      className="border-b border-t border-brand-border cursor-pointer hover:bg-brand-bg-2 transition-colors"
      onClick={onToggle}
    >
      <td colSpan={15} className="px-4 py-2">
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown size={13} className="text-brand-text-muted flex-shrink-0" />
            : <ChevronRight size={13} className="text-brand-text-muted flex-shrink-0" />}
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold" style={{ color }}>{title}</span>
          <span className="text-xs text-brand-text-muted font-medium ml-0.5">
            {count} empresa{count !== 1 ? 's' : ''}
          </span>
        </div>
      </td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Clientes() {
  const { userProfile } = useAuth()
  const { users } = useUsers()
  const navigate = useNavigate()

  const [leads, setLeads] = useState([])
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterProducto, setFilterProducto] = useState('')
  const [filterResponsable, setFilterResponsable] = useState('')
  const [openGroups, setOpenGroups] = useState({ nuevos: true, antiguos: true, perdidos: false })

  const seguimientoCheckDone = useRef(false)

  useEffect(() => {
    if (!userProfile?.companyId) return
    const unsub = subscribeLeads(userProfile.companyId, setLeads)
    return unsub
  }, [userProfile?.companyId])

  const clientes = useMemo(() => {
    return leads.filter((l) => {
      if (l.registroTipo !== 'cliente') return false
      if (search && !l.nombre?.toLowerCase().includes(search.toLowerCase())) return false
      if (filterTipo && l.tipoCliente !== filterTipo) return false
      if (filterProducto && l.producto !== filterProducto) return false
      if (filterResponsable && !getResponsables(l).includes(filterResponsable)) return false
      return true
    })
  }, [leads, search, filterTipo, filterProducto, filterResponsable])

  const grupos = useMemo(() => {
    const nuevos = [], antiguos = [], perdidos = []
    clientes.forEach((c) => {
      if (c.clienteEstado === 'perdido') perdidos.push(c)
      else if (getAnoAlta(c) < currentYear) antiguos.push(c)
      else nuevos.push(c)
    })
    return { nuevos, antiguos, perdidos }
  }, [clientes])

  // Auto-seguimiento: on page load, create tasks for overdue clients
  useEffect(() => {
    if (seguimientoCheckDone.current) return
    if (!clientes.length || !users.length || !userProfile?.companyId) return
    seguimientoCheckDone.current = true

    const today = new Date()
    clientes.forEach(async (c) => {
      if (!c.proximoSeguimiento) return
      if (c.seguimientoTaskId) return
      const proxDate = new Date(c.proximoSeguimiento + 'T12:00:00')
      if (proxDate > today) return
      const primerResponsable = getResponsables(c)[0]
      const responsableUser = users.find((u) => u.displayName === primerResponsable)
      if (!responsableUser) return
      try {
        const tipo = c.clienteEstado === 'perdido' ? 'cliente_perdido' : 'cliente_activo'
        const taskId = await createSeguimientoTask(userProfile.companyId, c, responsableUser.uid, tipo)
        await updateLead(c.id, { seguimientoTaskId: taskId })
      } catch (err) {
        console.error('Error creando tarea seguimiento:', err)
      }
    })
  }, [clientes, users, userProfile?.companyId])

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  const goDetail = (id) => navigate(`/crm/clientes/${id}`)

  const totalActivos = grupos.nuevos.length + grupos.antiguos.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-border bg-white flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-brand-text">Clientes</h1>
            <p className="text-xs text-brand-text-muted mt-0.5">
              {totalActivos} activo{totalActivos !== 1 ? 's' : ''} · {grupos.perdidos.length} perdido{grupos.perdidos.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-light" />
            <input
              className="input-field pl-8 h-8 text-xs w-48"
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select-field h-8 text-xs w-40" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
            <option value="">Tipo de cliente</option>
            {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="select-field h-8 text-xs w-36" value={filterProducto} onChange={(e) => setFilterProducto(e.target.value)}>
            <option value="">Producto</option>
            {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select-field h-8 text-xs w-44" value={filterResponsable} onChange={(e) => setFilterResponsable(e.target.value)}>
            <option value="">Responsable</option>
            {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-brand-text-muted">
            <p className="text-sm font-medium">No hay clientes todavía</p>
            <p className="text-xs mt-1">Marcá un contacto como "Ganado" para que aparezca aquí</p>
          </div>
        ) : (
          <table className="w-full min-w-[1450px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b-2 border-brand-border">
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Empresa</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Tipo</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Producto</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Kg / mes</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Lista de precios</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Seguimiento</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Persona contacto</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Puesto</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Teléfono</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">E-mail</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Ubicación</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Responsable</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Origen</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Fecha de alta</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {/* Clientes Nuevos */}
              <GroupHeaderRow
                title="Clientes nuevos"
                count={grupos.nuevos.length}
                open={openGroups.nuevos}
                onToggle={() => toggleGroup('nuevos')}
                color="#16A34A"
              />
              {openGroups.nuevos && grupos.nuevos.map((c) => (
                <TableRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
              ))}

              {/* Clientes Antiguos */}
              <GroupHeaderRow
                title="Clientes Antiguos"
                count={grupos.antiguos.length}
                open={openGroups.antiguos}
                onToggle={() => toggleGroup('antiguos')}
                color="#0369A1"
              />
              {openGroups.antiguos && grupos.antiguos.map((c) => (
                <TableRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
              ))}

              {/* Clientes Perdidos */}
              <GroupHeaderRow
                title="Clientes Perdidos"
                count={grupos.perdidos.length}
                open={openGroups.perdidos}
                onToggle={() => toggleGroup('perdidos')}
                color="#DC2626"
              />
              {openGroups.perdidos && grupos.perdidos.map((c) => (
                <TableRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
