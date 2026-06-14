import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutGrid, List } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import {
  CONTACTO_STAGES, TIPOS_CLIENTE, PRODUCTOS, RESPONSABLES, TIPO_CLIENTE_COLORS,
} from '../../utils/crmConstants'

const ALL_STAGES = Object.keys(CONTACTO_STAGES)

function TipoBadge({ tipo }) {
  if (!tipo) return null
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
      style={{ backgroundColor: TIPO_CLIENTE_COLORS[tipo] || '#94A3B8' }}
    >
      {tipo}
    </span>
  )
}

function ProductoBadge({ producto }) {
  if (!producto) return null
  return (
    <span className={`badge text-xs ${producto === 'Pastas Pariggi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-orange-50 text-brand-orange border border-orange-200'}`}>
      {producto}
    </span>
  )
}

// ── Kanban ───────────────────────────────────────────────────────────────────

function KanbanCard({ c, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-brand-border p-3 cursor-pointer hover:shadow-md hover:border-brand-orange/40 transition-all"
    >
      <h4 className="text-sm font-semibold text-brand-text mb-2 leading-tight">{c.nombre}</h4>
      <div className="flex flex-wrap gap-1 mb-1.5">
        <TipoBadge tipo={c.tipoCliente} />
        <ProductoBadge producto={c.producto} />
      </div>
      {c.kilosMensuales && (
        <p className="text-xs text-brand-text-muted mt-1">{c.kilosMensuales} kg / mes</p>
      )}
    </div>
  )
}

function KanbanColumn({ stageKey, contactos, onCardClick }) {
  const stage = CONTACTO_STAGES[stageKey]
  return (
    <div className="flex-shrink-0 w-52">
      <div
        className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
        style={{ backgroundColor: stage.kanban + '22' }}
      >
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: stage.kanban }} />
        <span className="text-xs font-semibold text-brand-text truncate flex-1">{stage.label}</span>
        <span className="text-xs text-brand-text-muted font-medium">{contactos.length}</span>
      </div>
      <div className="space-y-2 min-h-[32px]">
        {contactos.map((c) => (
          <KanbanCard key={c.id} c={c} onClick={() => onCardClick(c.id)} />
        ))}
      </div>
    </div>
  )
}

// ── Tabla ────────────────────────────────────────────────────────────────────

function TableRow({ c, onClick }) {
  const stage = CONTACTO_STAGES[c.estadoContacto] || CONTACTO_STAGES.contactado
  const primerContacto = c.contactos?.[0]
  return (
    <tr
      onClick={onClick}
      className="border-b border-brand-border hover:bg-brand-bg-2 cursor-pointer transition-colors"
    >
      <td className="py-2.5 px-4 text-sm font-medium text-brand-text">{c.nombre}</td>
      <td className="py-2.5 px-4">
        <span className={`badge border ${stage.color} text-xs`}>
          <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
          {stage.label}
        </span>
      </td>
      <td className="py-2.5 px-4"><TipoBadge tipo={c.tipoCliente} /></td>
      <td className="py-2.5 px-4"><ProductoBadge producto={c.producto} /></td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {c.kilosMensuales ? `${c.kilosMensuales} kg` : '—'}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {c.fechaCierre || '—'}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {primerContacto?.nombre || c.personaContacto || '—'}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {primerContacto?.telefono || c.telefono || '—'}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{c.responsable || '—'}</td>
    </tr>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Contactos() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterProducto, setFilterProducto] = useState('')
  const [filterResponsable, setFilterResponsable] = useState('')

  useEffect(() => {
    if (!userProfile?.companyId) return
    const unsub = subscribeLeads(userProfile.companyId, setLeads)
    return unsub
  }, [userProfile?.companyId])

  const contactos = useMemo(() => {
    return leads.filter((l) => {
      const isContacto = l.registroTipo === 'contacto' || (l.esCliente === true && !l.registroTipo)
      if (!isContacto) return false
      const nombre1 = l.contactos?.[0]?.nombre || l.personaContacto || ''
      if (search && !l.nombre?.toLowerCase().includes(search.toLowerCase()) &&
          !nombre1.toLowerCase().includes(search.toLowerCase())) return false
      if (filterTipo && l.tipoCliente !== filterTipo) return false
      if (filterProducto && l.producto !== filterProducto) return false
      if (filterResponsable && l.responsable !== filterResponsable) return false
      return true
    })
  }, [leads, search, filterTipo, filterProducto, filterResponsable])

  const kanbanGroups = useMemo(() => {
    const map = {}
    ALL_STAGES.forEach((k) => { map[k] = [] })
    contactos.forEach((c) => {
      const stage = c.estadoContacto || 'contactado'
      if (map[stage]) map[stage].push(c)
      else map['contactado'].push(c)
    })
    return map
  }, [contactos])

  const goDetail = (id) => navigate(`/crm/contactos/${id}`)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-border bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-brand-text">Contactos</h1>
            <p className="text-xs text-brand-text-muted mt-0.5">{contactos.length} en proceso de venta</p>
          </div>
          <div className="flex items-center border border-brand-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`p-1.5 transition-colors ${view === 'kanban' ? 'bg-brand-orange text-white' : 'bg-white text-brand-text-muted hover:bg-brand-bg-2'}`}
              title="Vista Kanban"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1.5 border-l border-brand-border transition-colors ${view === 'table' ? 'bg-brand-orange text-white' : 'bg-white text-brand-text-muted hover:bg-brand-bg-2'}`}
              title="Vista Tabla"
            >
              <List size={15} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-light" />
            <input
              className="input-field pl-8 h-8 text-xs w-48"
              placeholder="Buscar..."
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

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          {contactos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-brand-text-muted">
              <p className="text-sm font-medium">No hay contactos</p>
              <p className="text-xs mt-1">Marcá un lead como "Contactado" para que aparezca aquí</p>
            </div>
          ) : (
            <div className="flex gap-3 items-start pb-4" style={{ minWidth: 'max-content' }}>
              {ALL_STAGES.map((key) => (
                <KanbanColumn
                  key={key}
                  stageKey={key}
                  contactos={kanbanGroups[key] || []}
                  onCardClick={goDetail}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      {view === 'table' && (
        <div className="flex-1 overflow-y-auto p-4">
          {contactos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-brand-text-muted">
              <p className="text-sm font-medium">No hay contactos</p>
              <p className="text-xs mt-1">Marcá un lead como "Contactado" para que aparezca aquí</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-brand-border">
                    {['Empresa','Estado','Tipo','Producto','Kg / mes','Fecha cierre','Contacto','Teléfono','Responsable'].map((h) => (
                      <th key={h} className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contactos.map((c) => (
                    <TableRow key={c.id} c={c} onClick={() => goDetail(c.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
