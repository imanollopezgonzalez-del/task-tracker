import { useState, useEffect, useMemo } from 'react'
import { X, Send, Loader2, Users, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import { subscribeConnectedAccounts, subscribeMailTemplates, subscribeUnsubscribedEmails, sendBulkEmail } from '../../services/mailing'
import { TIPOS_CLIENTE, PRODUCTOS, RESPONSABLES } from '../../utils/crmConstants'
import { AUDIENCE_TYPES, CLIENTE_SEGMENTOS, filterAudience, resolveRecipient, excludeUnsubscribed } from '../../utils/mailingAudience'
import { useMailEditor, EmailEditorToolbar, EditorContent } from './EmailBodyEditor'

const MAX_RECIPIENTS = 500

export default function BulkSendPanel({ onClose }) {
  const { userProfile } = useAuth()
  const companyId = userProfile?.companyId

  const [leads, setLeads] = useState([])
  const [accounts, setAccounts] = useState([])
  const [templates, setTemplates] = useState([])
  const [unsubscribedEmails, setUnsubscribedEmails] = useState(new Set())
  const [fromAccountId, setFromAccountId] = useState('')
  const [audienceType, setAudienceType] = useState('clientes')
  const [tipo, setTipo] = useState('')
  const [producto, setProducto] = useState('')
  const [responsable, setResponsable] = useState('')
  const [segmentos, setSegmentos] = useState(['nuevos', 'antiguos'])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [pickedTemplateMode, setPickedTemplateMode] = useState(null) // 'rich' | 'html' | null
  const [htmlSourceOverride, setHtmlSourceOverride] = useState(null)

  const { editor, handlePickImage } = useMailEditor({ companyId })

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeLeads(companyId, setLeads)
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeConnectedAccounts(companyId, (list) => {
      setAccounts(list)
      setFromAccountId((current) => current || list[0]?.id || '')
    })
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailTemplates(companyId, setTemplates)
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeUnsubscribedEmails(companyId, setUnsubscribedEmails)
    return unsub
  }, [companyId])

  const audience = useMemo(() => {
    const matched = filterAudience(leads, { audienceType, tipo, producto, responsable, segmentos })
    const resolved = []
    let sinEmail = 0
    matched.forEach((r) => {
      const recipient = resolveRecipient(r)
      if (recipient) resolved.push(recipient)
      else sinEmail += 1
    })
    const { recipients, excluidos } = excludeUnsubscribed(resolved, unsubscribedEmails)
    return { recipients, sinEmail, excluidos, total: matched.length }
  }, [leads, audienceType, tipo, producto, responsable, segmentos, unsubscribedEmails])

  const toggleSegmento = (key) => {
    setSegmentos((prev) => prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key])
  }

  const handlePickTemplate = (id) => {
    setTemplateId(id)
    if (!id) {
      // "Escribir desde cero": volvemos al editor Tiptap normal
      setPickedTemplateMode(null)
      setHtmlSourceOverride(null)
      editor?.commands.setContent('')
      return
    }
    const t = templates.find((tpl) => tpl.id === id)
    if (!t) return
    setSubject(t.subject)
    if (t.mode === 'html') {
      // HTML pegado (Beefree, etc.): NO pasa por el schema de Tiptap, se guarda tal cual
      // y se manda byte-a-byte en el envío para no perder estilos/tablas.
      setPickedTemplateMode('html')
      setHtmlSourceOverride(t.htmlSource || '')
    } else {
      setPickedTemplateMode('rich')
      setHtmlSourceOverride(null)
      editor?.commands.setContent(t.richBodyHtml || '')
    }
  }

  const overLimit = audience.recipients.length > MAX_RECIPIENTS

  const handleSend = async () => {
    if (!fromAccountId) { toast.error('Elegí desde qué cuenta enviar'); return }
    if (!subject.trim()) { toast.error('Falta el asunto'); return }
    if (audience.recipients.length === 0) { toast.error('No hay destinatarios con ese filtro'); return }
    if (overLimit) { toast.error(`Hay ${audience.recipients.length} destinatarios, el máximo es ${MAX_RECIPIENTS}. Acotá el filtro.`); return }

    if (!window.confirm(`¿Enviar este email a ${audience.recipients.length} destinatarios?`)) return

    // Si hay una plantilla HTML cargada, se manda tal cual (sin pasar por el editor Tiptap,
    // que solo entiende su propio schema y destruiría estilos/tablas).
    const htmlBody = htmlSourceOverride != null ? htmlSourceOverride : (editor?.getHTML() || '')

    setSending(true)

    // El server puede tardar varios minutos con listas grandes (timeoutSeconds: 540) y no
    // tiene sentido bloquear el modal esperando el loop completo — el progreso ya se ve en
    // vivo en el historial (sentCount/failedCount/status vía onSnapshot). Pero las fallas de
    // validación del server (cuenta inválida, email mal formado, etc.) ocurren rápido, antes
    // de mandar ningún mail, y esas sí queremos mostrarlas en el modal antes de cerrarlo.
    // Truco: le damos una ventana corta a la promesa para que se resuelva/rechace; si no lo
    // hace a tiempo asumimos que ya está mandando de verdad y dejamos de esperar.
    const FAST_FAIL_WINDOW_MS = 4000
    const TIMEOUT = Symbol('timeout')
    const sendPromise = sendBulkEmail({
      fromAccountId,
      subject: subject.trim(),
      htmlBody,
      recipients: audience.recipients,
      templateId: templateId || null,
      audienceType,
    })

    const raced = await Promise.race([
      sendPromise.then(() => ({ ok: true })).catch((err) => ({ ok: false, err })),
      new Promise((resolve) => setTimeout(() => resolve(TIMEOUT), FAST_FAIL_WINDOW_MS)),
    ])

    if (raced !== TIMEOUT && raced.ok === false) {
      console.error(raced.err)
      toast.error(raced.err.message || 'Error al lanzar el envío masivo')
      setSending(false)
      return
    }

    // Ya sea que resolvió rápido o que superó la ventana de "fast fail": lo tratamos como
    // dispatchado al server. Si todavía está corriendo, seguimos escuchando el resultado
    // en segundo plano solo para loguear/avisar una falla real (no bloqueamos la UI).
    if (raced === TIMEOUT) {
      sendPromise.catch((err) => {
        console.error(err)
        toast.error(err.message || 'Error al enviar la campaña')
      })
    }
    toast.success('Envío masivo iniciado — mirá el progreso en el historial')
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text">Envío masivo</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          <div>
            <label className="label">Audiencia</label>
            <div className="flex items-center gap-2 mb-2">
              {AUDIENCE_TYPES.map((a) => (
                <button key={a.key} type="button" onClick={() => setAudienceType(a.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${audienceType === a.key ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-text-muted border-brand-border'}`}>
                  {a.label}
                </button>
              ))}
            </div>

            {audienceType === 'clientes' && (
              <div className="flex items-center gap-2 mb-2">
                {CLIENTE_SEGMENTOS.map((s) => (
                  <label key={s.key} className="flex items-center gap-1.5 text-xs text-brand-text-muted">
                    <input type="checkbox" checked={segmentos.includes(s.key)} onChange={() => toggleSegmento(s.key)} />
                    {s.label}
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <select className="select-field h-8 text-xs w-40" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Tipo de cliente</option>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="select-field h-8 text-xs w-36" value={producto} onChange={(e) => setProducto(e.target.value)}>
                <option value="">Producto</option>
                {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select className="select-field h-8 text-xs w-44" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                <option value="">Responsable</option>
                {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className={`flex items-center gap-1.5 mt-2 text-xs ${overLimit ? 'text-red-600' : 'text-brand-text-muted'}`}>
              <Users size={13} />
              {audience.recipients.length} destinatario{audience.recipients.length !== 1 ? 's' : ''} con email
              {audience.sinEmail > 0 && ` · ${audience.sinEmail} sin email, no reciben`}
              {audience.excluidos > 0 && ` · ${audience.excluidos} dado${audience.excluidos !== 1 ? 's' : ''} de baja, no reciben`}
              {overLimit && (
                <span className="flex items-center gap-1 font-medium">
                  <AlertTriangle size={13} /> supera el máximo de {MAX_RECIPIENTS}
                </span>
              )}
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="text-sm text-brand-text-muted bg-brand-bg-2 border border-brand-border rounded-lg px-3 py-2.5">
              No hay ninguna cuenta de Gmail conectada. Conectá una antes de enviar.
            </div>
          ) : (
            <div>
              <label className="label">Enviar desde</label>
              <select className="select-field" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.label || a.email}{a.status === 'reauth_required' ? ' (reconectar)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <label className="label">Plantilla</label>
              <select className="select-field" value={templateId} onChange={(e) => handlePickTemplate(e.target.value)}>
                <option value="">Escribir desde cero</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Asunto</label>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
          </div>

          <div>
            <label className="label">Mensaje</label>
            {pickedTemplateMode === 'html' ? (
              <div className="border border-brand-border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-amber-50 border-b border-brand-border text-[11px] text-amber-800">
                  Vista previa — plantilla HTML, se envía tal cual, sin editar acá
                </div>
                <iframe
                  title="Vista previa del email"
                  srcDoc={htmlSourceOverride || ''}
                  sandbox=""
                  className="w-full h-96 bg-white"
                />
              </div>
            ) : (
              <div className="border border-brand-border rounded-lg overflow-hidden">
                <EmailEditorToolbar editor={editor} onPickImage={handlePickImage} mergeFields />
                <div className="mail-editor-content px-3 py-2.5 max-h-64 overflow-y-auto" onClick={() => editor?.chain().focus().run()}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-brand-border">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="button" onClick={handleSend} disabled={sending || overLimit || audience.recipients.length === 0} className="btn-primary">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Enviando...' : `Enviar a ${audience.recipients.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}
