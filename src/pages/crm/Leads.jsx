import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, ChevronRight, Phone, Mail, MapPin, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import { LEAD_STAGES, TIPOS_CLIENTE, PRODUCTOS, GRUPOS_LISTA, ORIGENES_CONTACTO, RESPONSABLES } from '../../utils/crmConstants'
import LeadForm from '../../components/crm/LeadForm'

function StageBadge({ estado }) {
  const s = LEAD_STAGES[estado] || LEAD_STAGES.lead_nuevo
  return (
    <span className={`badge border ${s.color} text-xs`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function LeadRow({ lead, onClick }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-brand-border hover:bg-brand-bg-2 cursor-pointer transition-colors"
    >
      <td className="py-2.5 px-4 text-sm font-medium text-brand-text">{lead.nombre}</td>
      <td className="py-2.5 px-4"><StageBadge estado={lead.estado} /></td>
      <td className="py-2.5 px-4">
        {lead.tipoCliente && (
          <span className="text-xs text-brand-text-muted">{lead.tipoCliente}</span>
        )}
      </td>
      <td className="py-2.5 px-4">
        {lead.producto && (
          <span className={`badge text-xs ${lead.producto === 'Pastas Pariggi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-orange-50 text-brand-orange border border-orange-200'}`}>
            {lead.producto}
          </span>
        )}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {lead.contactos?.[0]?.nombre || lead.personaContacto || '—'}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">
        {(lead.contactos?.[0]?.telefono || lead.telefono) && (
          <span className="flex items-center gap-1">
            <Phone size={11} />
            {lead.contactos?.[0]?.telefono || lead.telefono}
          </span>
        )}
      </td>
      <td className="py-2.5 px-4 text-xs text-brand-text-muted">{lead.responsable || '—'}</td>
    </tr>
  )
}

function GroupSection({ grupo, leads, onLeadClick, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const g = GRUPOS_LISTA.find((g) => g.key === grupo) || { label: grupo, color: '#94A3B8' }

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-brand-bg-2 rounded-lg transition-colors"
      >
        <span
          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: g.color }}
        />
        <span className="text-sm font-semibold text-brand-text">{g.label}</span>
        <span className="text-xs text-brand-text-muted ml-1">({leads.length})</span>
        <span className="ml-auto text-brand-text-muted">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Nombre</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Estado</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Tipo</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Producto</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Contacto</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Teléfono</th>
                <th className="text-left py-1.5 px-4 text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Responsable</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRow key={lead.id} lead={lead} onClick={() => onLeadClick(lead.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Leads() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterProducto, setFilterProducto] = useState('')
  const [filterResponsable, setFilterResponsable] = useState('')

  useEffect(() => {
    if (!userProfile?.companyId) return
    const unsub = subscribeLeads(userProfile.companyId, setLeads)
    return unsub
  }, [userProfile?.companyId])

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (l.esCliente) return false
      const primerContacto = l.contactos?.[0]
      const nombreContacto = primerContacto?.nombre || l.personaContacto || ''
      const emailContacto = primerContacto?.emails?.[0] || l.email || ''
      if (search && !l.nombre?.toLowerCase().includes(search.toLowerCase()) &&
          !nombreContacto.toLowerCase().includes(search.toLowerCase()) &&
          !emailContacto.toLowerCase().includes(search.toLowerCase())) return false
      if (filterTipo && l.tipoCliente !== filterTipo) return false
      if (filterProducto && l.producto !== filterProducto) return false
      if (filterResponsable && l.responsable !== filterResponsable) return false
      return true
    })
  }, [leads, search, filterTipo, filterProducto, filterResponsable])

  // Grupos en el orden de GRUPOS_LISTA
  // Los "No contactados" y "Clientes a Recuperar" son grupos virtuales basados en estado
  const groupOrder = GRUPOS_LISTA.map((g) => g.key)
  const grouped = useMemo(() => {
    const map = {}
    groupOrder.forEach((k) => { map[k] = [] })
    filtered.forEach((l) => {
      // Leads con estado especial van a grupos virtuales
      if (l.estado === 'no_contactado') {
        map['No contactados'].push(l)
      } else if (l.estado === 'reintentar_contacto') {
        map['Clientes a Recuperar'].push(l)
      } else {
        const g = l.grupo || l.origenContacto || 'Google Researching'
        if (!map[g]) map[g] = []
        map[g].push(l)
      }
    })
    return map
  }, [filtered])

  const totalLeads = leads.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-brand-border bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-brand-text">Leads</h1>
            <p className="text-xs text-brand-text-muted mt-0.5">{totalLeads} leads en total</p>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={15} />
            Agregar empresa
          </button>
        </div>

        {/* Filtros */}
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

      {/* Tabla con grupos */}
      <div className="flex-1 overflow-y-auto p-4">
        {groupOrder.map((key) => {
          const groupLeads = grouped[key] || []
          if (groupLeads.length === 0) return null
          return (
            <GroupSection
              key={key}
              grupo={key}
              leads={groupLeads}
              onLeadClick={(id) => navigate(`/crm/leads/${id}`)}
              defaultOpen
            />
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-brand-text-muted">
            <User size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No hay leads</p>
            <p className="text-xs mt-1">
              {search || filterTipo || filterProducto || filterResponsable || filterContactado
                ? 'Probá cambiando los filtros'
                : 'Hacé clic en "Agregar empresa" para empezar'}
            </p>
          </div>
        )}
      </div>

      {showForm && (
        <LeadForm
          companyId={userProfile?.companyId}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
