import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Trash2, XCircle, TrendingDown, RotateCcw,
  StickyNote, AlertCircle, Send, Phone, Mail, User, Calendar,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getLead, updateLead, deleteLead, addNota, updateNota, subscribeNotas, deleteNota } from '../../services/leads'
import {
  CONTACTO_STAGES, NOTE_TYPES, TIPO_CLIENTE_COLORS,
  TIPOS_CLIENTE, PRODUCTOS, ORIGENES_CONTACTO, LISTAS_PRECIO,
} from '../../utils/crmConstants'
import { getResponsables } from '../../utils/crmHelpers'
import LeadForm from '../../components/crm/LeadForm'
import toast from 'react-hot-toast'

// ── Inline editing ─────────────────────────────────────────────────────────────

function InlineText({ value, onChange, placeholder = '—' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (value || '').trim()) onChange(trimmed)
  }
  if (editing) {
    return (
      <input
        className="w-full text-sm text-brand-text border border-brand-border rounded px-2 py-0.5 outline-none focus:border-brand-orange bg-white"
        value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
        }}
      />
    )
  }
  return (
    <p
      className={`text-sm font-medium cursor-pointer hover:bg-brand-bg-2 rounded px-1 -mx-1 py-0.5 ${value ? 'text-brand-text' : 'text-brand-text-light italic'}`}
      onClick={() => { setDraft(value || ''); setEditing(true) }}
      title="Click para editar"
    >
      {value || placeholder}
    </p>
  )
}

function InlineSelect({ value, options, onChange, placeholder = '—', renderValue }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <select
        className="w-full text-sm border border-brand-border rounded px-2 py-1 outline-none focus:border-brand-orange bg-white"
        value={value || ''} autoFocus
        onChange={(e) => { onChange(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) =>
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.key} value={o.key}>{o.label}</option>
        )}
      </select>
    )
  }
  return (
    <div className="cursor-pointer hover:bg-brand-bg-2 rounded px-1 -mx-1 py-0.5 min-h-[24px]" onClick={() => setEditing(true)} title="Click para editar">
      {renderValue
        ? renderValue(value)
        : <p className={`text-sm font-medium ${value ? 'text-brand-text' : 'text-brand-text-light italic'}`}>{value || placeholder}</p>
      }
    </div>
  )
}

// ── Notes ──────────────────────────────────────────────────────────────────────

function NotaItem({ nota, onDelete, onEdit, canDelete }) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(nota.texto)
  const [saving, setSaving] = useState(false)
  const isImportante = nota.tipo === 'importante'
  const ts = nota.createdAt?.toDate ? nota.createdAt.toDate() : new Date()
  const dateStr = ts.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const handleSave = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      await onEdit(nota.id, editText.trim())
      setEditing(false)
    } catch {
      toast.error('Error al guardar la nota')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-xl border p-3 ${isImportante ? 'bg-orange-50 border-orange-200' : 'bg-brand-bg-2 border-brand-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isImportante
            ? <AlertCircle size={14} className="text-brand-orange mt-0.5 flex-shrink-0" />
            : <StickyNote size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />}
          {editing ? (
            <div className="flex-1">
              <textarea
                className="w-full text-sm text-brand-text resize-none outline-none bg-white border border-brand-border rounded-lg px-2 py-1.5"
                rows={3} value={editText} autoFocus
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="flex gap-2 mt-1.5">
                <button onClick={handleSave} disabled={saving} className="btn-primary py-0.5 px-2 text-xs">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => { setEditing(false); setEditText(nota.texto) }} className="btn-secondary py-0.5 px-2 text-xs">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-brand-text whitespace-pre-wrap break-words">{nota.texto}</p>
          )}
        </div>
        {!editing && canDelete && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => setEditing(true)} className="text-brand-text-muted hover:text-brand-text p-0.5"><Edit2 size={13} /></button>
            <button onClick={() => onDelete(nota.id)} className="text-brand-text-muted hover:text-red-500 p-0.5"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
      <p className="text-xs text-brand-text-muted mt-1.5 ml-5">
        {nota.autorNombre} · {dateStr}
        {nota.editedAt && <span className="italic ml-1">(editado)</span>}
      </p>
    </div>
  )
}

// ── Contacts view ──────────────────────────────────────────────────────────────

function ContactoCard({ c, index, total }) {
  const emails = (c.emails || []).filter(Boolean)
  if (!c.nombre && !c.telefono && emails.length === 0) return null
  return (
    <div className="py-1.5 border-b border-brand-border last:border-0">
      {total > 1 && <p className="text-xs font-semibold text-brand-text-muted mb-1">Contacto {index + 1}</p>}
      {(c.nombre || c.puesto) && (
        <div className="flex items-start gap-2 py-0.5">
          <User size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {c.nombre && <p className="text-sm text-brand-text font-medium leading-tight">{c.nombre}</p>}
            {c.puesto && <p className="text-xs text-brand-text-muted">{c.puesto}</p>}
          </div>
        </div>
      )}
      {c.telefono && (
        <div className="flex items-start gap-2 py-0.5">
          <Phone size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <p className="text-sm text-brand-text font-medium">{c.telefono}</p>
        </div>
      )}
      {emails.map((e, ei) => (
        <div key={ei} className="flex items-start gap-2 py-0.5">
          <Mail size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <p className="text-sm text-brand-text font-medium break-words">{e}</p>
        </div>
      ))}
    </div>
  )
}

// ── Seguimiento section ────────────────────────────────────────────────────────

function SeguimientoPanel({ cliente, onRegistrar }) {
  const hoy = new Date()
  const proxDate = cliente.proximoSeguimiento
    ? new Date(cliente.proximoSeguimiento + 'T12:00:00')
    : null
  const isPendiente = !proxDate || proxDate <= hoy
  const fmtDate = (str) => str
    ? new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  return (
    <div className="py-2">
      <p className="text-xs text-brand-text-muted mb-2">Seguimiento (cada 45 días)</p>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-brand-text-muted flex items-center gap-1"><Calendar size={11} /> Último</span>
          <span className="text-xs text-brand-text font-medium">{fmtDate(cliente.ultimoSeguimiento)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-brand-text-muted flex items-center gap-1"><Calendar size={11} /> Próximo</span>
          <span className={`text-xs font-medium ${isPendiente ? 'text-red-600' : 'text-green-700'}`}>
            {fmtDate(cliente.proximoSeguimiento)}
          </span>
        </div>
        <div className="mt-1">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
            isPendiente
              ? 'bg-gray-100 text-gray-600 border-gray-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isPendiente ? 'bg-gray-400' : 'bg-green-500'}`} />
            {isPendiente ? 'Pendiente' : 'Contactado'}
          </span>
        </div>
        <button
          onClick={onRegistrar}
          className="w-full mt-1 py-1.5 text-xs font-medium text-brand-orange border border-brand-orange/40 rounded-lg hover:bg-orange-50 transition-colors"
        >
          Registrar seguimiento
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function ClienteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [notaTexto, setNotaTexto] = useState('')
  const [notaTipo, setNotaTipo] = useState('nota')
  const [savingNota, setSavingNota] = useState(false)

  useEffect(() => {
    getLead(id).then((data) => { setCliente(data); setLoading(false) })
  }, [id])

  const refreshCliente = () => getLead(id).then(setCliente)

  useEffect(() => {
    const unsub = subscribeNotas(id, setNotas)
    return unsub
  }, [id])

  const handleSave = async (field, value) => {
    await updateLead(id, { [field]: value })
    setCliente((c) => ({ ...c, [field]: value }))
  }

  const handleMarcarPerdido = async () => {
    if (!window.confirm(`¿Marcar "${cliente?.nombre}" como cliente perdido?`)) return
    const today = new Date().toISOString().split('T')[0]
    await updateLead(id, {
      clienteEstado: 'perdido',
      fechaPerdido: today,
      seguimientoTaskId: null,
    })
    setCliente((c) => ({ ...c, clienteEstado: 'perdido', fechaPerdido: today, seguimientoTaskId: null }))
    toast.success('Cliente marcado como perdido')
  }

  const handleRecuperar = async () => {
    const hoy = new Date()
    const nextDate = new Date(hoy)
    nextDate.setDate(nextDate.getDate() + 45)
    const fmt = (d) => d.toISOString().split('T')[0]
    await updateLead(id, {
      clienteEstado: 'activo',
      fechaPerdido: null,
      proximoSeguimiento: fmt(nextDate),
      seguimientoTaskId: null,
    })
    setCliente((c) => ({ ...c, clienteEstado: 'activo', fechaPerdido: null, proximoSeguimiento: fmt(nextDate) }))
    toast.success('Cliente recuperado')
  }

  const handleDevolverAContactos = async () => {
    if (!window.confirm(`¿Devolver "${cliente?.nombre}" al módulo de Contactos?`)) return
    await updateLead(id, {
      registroTipo: 'contacto',
      clienteEstado: null,
      anoAlta: null,
      fechaCierre: null,
      proximoSeguimiento: null,
      ultimoSeguimiento: null,
      seguimientoTaskId: null,
      estadoContacto: 'seguimiento',
    })
    toast.success('Movido de vuelta a Contactos')
    navigate('/crm/contactos')
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar permanentemente "${cliente?.nombre}"?`)) return
    await deleteLead(id)
    toast.success('Cliente eliminado')
    navigate('/crm/clientes')
  }

  const handleRegistrarSeguimiento = async () => {
    const hoy = new Date()
    const nextDate = new Date(hoy)
    nextDate.setDate(nextDate.getDate() + 45)
    const fmt = (d) => d.toISOString().split('T')[0]
    const updates = {
      ultimoSeguimiento: fmt(hoy),
      proximoSeguimiento: fmt(nextDate),
      seguimientoTaskId: null,
    }
    await updateLead(id, updates)
    setCliente((c) => ({ ...c, ...updates }))
    toast.success('Seguimiento registrado. Próximo en 45 días.')
  }

  const handleAddNota = async (e) => {
    e.preventDefault()
    if (!notaTexto.trim()) return
    setSavingNota(true)
    try {
      await addNota(id, notaTexto.trim(), notaTipo, currentUser)
      setNotaTexto('')
      setNotaTipo('nota')
    } catch { toast.error('Error al guardar la nota') }
    finally { setSavingNota(false) }
  }

  const handleDeleteNota = async (notaId) => { await deleteNota(id, notaId); toast.success('Nota eliminada') }
  const handleEditNota = async (notaId, texto) => { await updateNota(id, notaId, texto) }

  if (loading) return <div className="flex items-center justify-center h-full text-brand-text-muted text-sm">Cargando...</div>
  if (!cliente) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-brand-text-muted text-sm">Cliente no encontrado</p>
      <button onClick={() => navigate('/crm/clientes')} className="btn-secondary text-xs">Volver</button>
    </div>
  )

  const isPerdido = cliente.clienteEstado === 'perdido'
  const fmtFecha = (str) => str
    ? new Date(str + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  const contactosList = cliente.contactos?.length > 0
    ? cliente.contactos
    : (cliente.personaContacto || cliente.telefono || cliente.email)
      ? [{ nombre: cliente.personaContacto, puesto: cliente.puesto, telefono: cliente.telefono, emails: cliente.email ? [cliente.email] : [] }]
      : []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="px-5 py-3 border-b border-brand-border bg-white flex items-center gap-3 flex-shrink-0 flex-wrap">
        <button onClick={() => navigate('/crm/clientes')} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold text-brand-text flex-1 truncate">{cliente.nombre}</h1>

        {isPerdido ? (
          <button
            onClick={handleRecuperar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-green-700 border-green-200 hover:bg-green-50 transition-colors"
          >
            <RotateCcw size={13} /> Recuperar cliente
          </button>
        ) : (
          <button
            onClick={handleMarcarPerdido}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-red-600 border-red-200 hover:bg-red-50 transition-colors"
          >
            <TrendingDown size={13} /> Marcar perdido
          </button>
        )}

        <button
          onClick={handleDevolverAContactos}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white text-brand-text-muted border-brand-border hover:bg-brand-bg-2 transition-colors"
        >
          <XCircle size={13} /> Devolver a Contactos
        </button>

        {isPerdido && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Cliente Perdido
            {cliente.fechaPerdido && <span className="text-red-400 ml-1">· {fmtFecha(cliente.fechaPerdido)}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Notes panel */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-3">
            Emails y actividades
          </p>
          <div className="space-y-2 mb-4">
            {notas.length === 0 && (
              <p className="text-xs text-brand-text-muted py-4 text-center">No hay notas todavía</p>
            )}
            {notas.map((nota) => (
              <NotaItem
                key={nota.id}
                nota={nota}
                onDelete={handleDeleteNota}
                onEdit={handleEditNota}
                canDelete={nota.autorId === currentUser?.uid || userProfile?.role === 'admin'}
              />
            ))}
          </div>
          <form onSubmit={handleAddNota} className="border border-brand-border rounded-xl bg-white overflow-hidden">
            <textarea
              className="w-full px-3 py-2.5 text-sm text-brand-text resize-none outline-none placeholder:text-brand-text-light"
              rows={3}
              placeholder="Agregar una nota..."
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 border-t border-brand-border pt-2">
              <div className="flex items-center gap-2">
                {Object.entries(NOTE_TYPES).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="tipo" value={k} checked={notaTipo === k} onChange={() => setNotaTipo(k)} className="accent-brand-orange" />
                    <span className="text-xs text-brand-text-muted">{v.label}</span>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={savingNota || !notaTexto.trim()} className="btn-primary py-1 px-3 text-xs">
                <Send size={12} /> {savingNota ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>

        {/* Right panel */}
        <div className="w-72 flex-shrink-0 border-l border-brand-border bg-white overflow-y-auto">
          <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Información de cliente</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowEdit(true)} className="btn-ghost p-1" title="Editar contactos">
                <Edit2 size={14} />
              </button>
              <button onClick={handleDelete} className="btn-ghost p-1 text-red-500 hover:text-red-600 hover:bg-red-50" title="Eliminar">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="px-4 py-2 divide-y divide-brand-border">
            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Nombre</p>
              <InlineText value={cliente.nombre} onChange={(v) => handleSave('nombre', v)} placeholder="Sin nombre" />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Tipo de cliente</p>
              <InlineSelect
                value={cliente.tipoCliente}
                options={TIPOS_CLIENTE}
                onChange={(v) => handleSave('tipoCliente', v)}
                placeholder="Sin tipo"
                renderValue={(v) => v
                  ? <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: TIPO_CLIENTE_COLORS[v] || '#94A3B8' }}>{v}</span>
                  : <p className="text-sm text-brand-text-light italic">Sin tipo</p>
                }
              />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Producto</p>
              <InlineSelect
                value={cliente.producto}
                options={PRODUCTOS}
                onChange={(v) => handleSave('producto', v)}
                placeholder="Sin producto"
                renderValue={(v) => v
                  ? <span className={`badge text-xs ${v === 'Pastas Pariggi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-orange-50 text-brand-orange border border-orange-200'}`}>{v}</span>
                  : <p className="text-sm text-brand-text-light italic">Sin producto</p>
                }
              />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Kilos mensuales</p>
              <InlineText value={cliente.kilosMensuales} onChange={(v) => handleSave('kilosMensuales', v)} placeholder="—" />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Lista de precios</p>
              <InlineSelect
                value={cliente.listaPrecios}
                options={LISTAS_PRECIO}
                onChange={(v) => handleSave('listaPrecios', v)}
                placeholder="Sin lista"
              />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1.5">Contactos</p>
              {contactosList.length > 0
                ? contactosList.map((c, i) => <ContactoCard key={i} c={c} index={i} total={contactosList.length} />)
                : <p className="text-sm text-brand-text-light italic py-1">Sin contactos — usar ✏️ Editar</p>
              }
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Ubicación</p>
              <InlineText value={cliente.ubicacion} onChange={(v) => handleSave('ubicacion', v)} placeholder="Sin ubicación" />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Responsable(s)</p>
              {getResponsables(cliente).length > 0
                ? <p className="text-sm font-medium text-brand-text">{getResponsables(cliente).join(', ')}</p>
                : <p className="text-sm text-brand-text-light italic">Sin responsable — usar ✏️ Editar</p>
              }
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Origen del contacto</p>
              <InlineSelect
                value={cliente.origenContacto}
                options={ORIGENES_CONTACTO}
                onChange={(v) => handleSave('origenContacto', v)}
                placeholder="Sin origen"
              />
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Fecha de alta</p>
              <p className="text-sm font-medium text-brand-text">
                {cliente.fechaCierre
                  ? new Date(cliente.fechaCierre + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>

            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Última actualización</p>
              <p className="text-sm font-medium text-brand-text">
                {cliente.updatedAt?.toDate
                  ? cliente.updatedAt.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>

            <div className="py-2 border-t-2 border-brand-border">
              <SeguimientoPanel cliente={cliente} onRegistrar={handleRegistrarSeguimiento} />
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <LeadForm
          lead={cliente}
          companyId={userProfile?.companyId}
          showContactoFields
          onClose={() => { setShowEdit(false); refreshCliente() }}
        />
      )}
    </div>
  )
}
