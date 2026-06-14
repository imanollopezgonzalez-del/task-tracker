import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Mail, MapPin, User, Edit2, Trash2,
  CheckCircle, XCircle, StickyNote, AlertCircle, Send,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getLead, updateLead, deleteLead, addNota, updateNota, subscribeNotas, deleteNota } from '../../services/leads'
import { CONTACTO_STAGES, CONTACTO_PIPELINE, NOTE_TYPES, TIPO_CLIENTE_COLORS } from '../../utils/crmConstants'
import LeadForm from '../../components/crm/LeadForm'
import toast from 'react-hot-toast'

function PipelineBar({ current, onChange }) {
  const currentIdx = CONTACTO_PIPELINE.indexOf(current)
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {CONTACTO_PIPELINE.map((step, i) => {
        const s = CONTACTO_STAGES[step]
        const isActive = step === current
        const isPast = i < currentIdx
        return (
          <button
            key={step}
            onClick={() => onChange(step)}
            className={`
              flex-1 min-w-[90px] px-2 py-1.5 text-xs font-medium border-y border-r
              first:border-l first:rounded-l-lg last:rounded-r-lg transition-colors
              ${isPast ? 'bg-green-500 text-white border-green-500' : ''}
              ${!isActive && !isPast ? 'bg-white text-brand-text-muted border-brand-border hover:bg-brand-bg-2' : ''}
            `}
            style={isActive ? { backgroundColor: s.kanban, borderColor: s.kanban, color: 'white' } : {}}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-brand-border last:border-0">
      <Icon size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-brand-text-muted leading-none mb-0.5">{label}</p>
        <p className="text-sm text-brand-text font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

function ContactoCard({ c, index, total }) {
  const emails = (c.emails || []).filter(Boolean)
  if (!c.nombre && !c.telefono && emails.length === 0) return null
  return (
    <div className="py-2 border-b border-brand-border last:border-0">
      {total > 1 && (
        <p className="text-xs font-semibold text-brand-text-muted mb-1.5">Contacto {index + 1}</p>
      )}
      {(c.nombre || c.puesto) && (
        <div className="flex items-start gap-2.5 py-1.5">
          <User size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {c.nombre && <p className="text-sm text-brand-text font-medium leading-tight">{c.nombre}</p>}
            {c.puesto && <p className="text-xs text-brand-text-muted mt-0.5">{c.puesto}</p>}
          </div>
        </div>
      )}
      {c.telefono && (
        <div className="flex items-start gap-2.5 py-1.5">
          <Phone size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <p className="text-sm text-brand-text font-medium">{c.telefono}</p>
        </div>
      )}
      {emails.map((e, ei) => (
        <div key={ei} className="flex items-start gap-2.5 py-1.5">
          <Mail size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            {emails.length > 1 && <p className="text-xs text-brand-text-muted leading-none mb-0.5">Email {ei + 1}</p>}
            <p className="text-sm text-brand-text font-medium break-words">{e}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

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
    await onEdit(nota.id, editText.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className={`rounded-xl border p-3 ${isImportante ? 'bg-orange-50 border-orange-200' : 'bg-brand-bg-2 border-brand-border'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isImportante
            ? <AlertCircle size={14} className="text-brand-orange mt-0.5 flex-shrink-0" />
            : <StickyNote size={14} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
          }
          {editing ? (
            <div className="flex-1">
              <textarea
                className="w-full text-sm text-brand-text resize-none outline-none bg-white border border-brand-border rounded-lg px-2 py-1.5"
                rows={3}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
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

export default function ContactoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser, userProfile } = useAuth()
  const [contacto, setContacto] = useState(null)
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [notaTexto, setNotaTexto] = useState('')
  const [notaTipo, setNotaTipo] = useState('nota')
  const [savingNota, setSavingNota] = useState(false)

  useEffect(() => {
    getLead(id).then((data) => { setContacto(data); setLoading(false) })
  }, [id])

  const refreshContacto = () => getLead(id).then(setContacto)

  useEffect(() => {
    const unsub = subscribeNotas(id, setNotas)
    return unsub
  }, [id])

  const handleStageChange = async (newStage) => {
    await updateLead(id, { estadoContacto: newStage })
    setContacto((c) => ({ ...c, estadoContacto: newStage }))
    toast.success(`Etapa: "${CONTACTO_STAGES[newStage]?.label}"`)
  }

  const handleGanado = async () => {
    await updateLead(id, { registroTipo: 'cliente', estadoContacto: 'ganado' })
    toast.success('¡Ganado! Movido a Clientes')
    navigate('/crm/contactos')
  }

  const handlePerdido = async () => {
    await updateLead(id, {
      registroTipo: 'lead',
      estado: 'reintentar_contacto',
      estadoContacto: null,
      esCliente: false,
    })
    toast.success('Volvió a Leads como "Reintentar contacto"')
    navigate('/crm/contactos')
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar "${contacto.nombre}"?`)) return
    await deleteLead(id)
    toast.success('Eliminado')
    navigate('/crm/contactos')
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

  if (loading) return (
    <div className="flex items-center justify-center h-full text-brand-text-muted text-sm">Cargando...</div>
  )
  if (!contacto) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-brand-text-muted text-sm">Contacto no encontrado</p>
      <button onClick={() => navigate('/crm/contactos')} className="btn-secondary text-xs">Volver</button>
    </div>
  )

  const currentStage = contacto.estadoContacto || 'contactado'
  const stage = CONTACTO_STAGES[currentStage] || CONTACTO_STAGES.contactado
  const isTerminal = ['ganado', 'perdido'].includes(currentStage)

  const contactosList = contacto.contactos?.length > 0
    ? contacto.contactos
    : (contacto.personaContacto || contacto.telefono || contacto.email)
      ? [{ nombre: contacto.personaContacto, puesto: contacto.puesto, telefono: contacto.telefono, emails: contacto.email ? [contacto.email] : [] }]
      : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Panel principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="px-5 py-3 border-b border-brand-border bg-white flex items-center gap-3">
          <button onClick={() => navigate('/crm/contactos')} className="btn-ghost p-1.5">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-bold text-brand-text flex-1 truncate">{contacto.nombre}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGanado}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                currentStage === 'ganado'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
              }`}
            >
              <CheckCircle size={13} /> Ganado
            </button>
            <button
              onClick={handlePerdido}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                currentStage === 'perdido'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
              }`}
            >
              <XCircle size={13} /> Perdido
            </button>
            <button onClick={() => setShowEdit(true)} className="btn-ghost p-1.5" title="Editar">
              <Edit2 size={15} />
            </button>
            <button onClick={handleDelete} className="btn-ghost p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50" title="Eliminar">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Pipeline */}
        <div className="px-5 py-3 border-b border-brand-border bg-white">
          <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide mb-2">
            Etapas de la oportunidad de venta
          </p>
          {isTerminal ? (
            <div className="flex items-center gap-2">
              <span className={`badge border text-xs ${stage.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                {stage.label}
              </span>
              <button
                onClick={() => handleStageChange('contactado')}
                className="text-xs text-brand-text-muted hover:text-brand-text underline"
              >
                Reabrir
              </button>
            </div>
          ) : (
            <PipelineBar current={currentStage} onChange={handleStageChange} />
          )}
        </div>

        {/* Notas */}
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
                <Send size={12} />
                {savingNota ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Panel derecho */}
      <div className="w-72 flex-shrink-0 border-l border-brand-border bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-brand-border">
          <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">Información</p>
        </div>
        <div className="px-4 py-2">
          <InfoRow icon={User} label="Nombre" value={contacto.nombre} />

          <div className="py-2 border-b border-brand-border">
            <p className="text-xs text-brand-text-muted mb-1">Estado</p>
            <span className={`badge border text-xs ${stage.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
              {stage.label}
            </span>
          </div>

          {contacto.tipoCliente && (
            <div className="py-2 border-b border-brand-border">
              <p className="text-xs text-brand-text-muted mb-1">Tipo de cliente</p>
              <span
                className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: TIPO_CLIENTE_COLORS[contacto.tipoCliente] || '#94A3B8' }}
              >
                {contacto.tipoCliente}
              </span>
            </div>
          )}

          {contacto.producto && (
            <div className="py-2 border-b border-brand-border">
              <p className="text-xs text-brand-text-muted mb-1">Producto</p>
              <span className={`badge text-xs ${contacto.producto === 'Pastas Pariggi' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-orange-50 text-brand-orange border border-orange-200'}`}>
                {contacto.producto}
              </span>
            </div>
          )}

          {contacto.kilosMensuales && (
            <div className="py-2 border-b border-brand-border">
              <p className="text-xs text-brand-text-muted mb-1">Kilos mensuales</p>
              <p className="text-sm font-medium text-brand-text">{contacto.kilosMensuales} kg</p>
            </div>
          )}

          {contacto.fechaCierre && (
            <div className="py-2 border-b border-brand-border">
              <p className="text-xs text-brand-text-muted mb-1">Fecha estimada de cierre</p>
              <p className="text-sm font-medium text-brand-text">{new Date(contacto.fechaCierre + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
          )}

          {contactosList.map((c, i) => (
            <ContactoCard key={i} c={c} index={i} total={contactosList.length} />
          ))}

          <InfoRow icon={MapPin} label="Ubicación" value={contacto.ubicacion} />

          {contacto.responsable && (
            <div className="py-2 border-b border-brand-border">
              <p className="text-xs text-brand-text-muted mb-1">Responsable</p>
              <span className="text-sm font-medium text-brand-text">{contacto.responsable}</span>
            </div>
          )}

          {contacto.origenContacto && (
            <div className="py-2">
              <p className="text-xs text-brand-text-muted mb-1">Origen del contacto</p>
              <span className="text-sm font-medium text-brand-text">{contacto.origenContacto}</span>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <LeadForm
          lead={contacto}
          companyId={userProfile?.companyId}
          showContactoFields
          onClose={() => { setShowEdit(false); refreshContacto() }}
        />
      )}
    </div>
  )
}
