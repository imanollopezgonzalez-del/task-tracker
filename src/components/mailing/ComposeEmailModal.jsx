import { useState, useEffect } from 'react'
import {
  X, Paperclip, Send, Loader2, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeConnectedAccounts, sendEmail, uploadMailingAttachment, subscribeMailTemplates } from '../../services/mailing'
import { useMailEditor, EmailEditorToolbar, EditorContent } from './EmailBodyEditor'
import DriveAttachButton from './DriveAttachButton'
export default function ComposeEmailModal({ to = '', leadId = null, onClose }) {
  const { userProfile } = useAuth()
  const companyId = userProfile?.companyId

  const [accounts, setAccounts] = useState([])
  const [fromAccountId, setFromAccountId] = useState('')
  const [toValue, setToValue] = useState(to)
  const [subject, setSubject] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [templates, setTemplates] = useState([])
  const [pickedTemplateMode, setPickedTemplateMode] = useState(null) // 'rich' | 'html' | null
  const [htmlSourceOverride, setHtmlSourceOverride] = useState(null)

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

  const { editor, handlePickImage } = useMailEditor({ companyId })

  const handlePickTemplate = (id) => {
    if (!id) {
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

  const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024 // igual al límite de storage.rules

  const handlePickAttachment = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size >= MAX_ATTACHMENT_BYTES) {
        toast.error(`"${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el máximo es 20MB`)
        return
      }
      const tempId = crypto.randomUUID()
      setAttachments((list) => [...list, { id: tempId, filename: file.name, uploading: true }])
      try {
        const uploaded = await uploadMailingAttachment(companyId, file)
        setAttachments((list) => list.map((a) => (a.id === tempId ? { ...uploaded, id: tempId } : a)))
      } catch (err) {
        console.error(err)
        // storage/unauthorized es el código genérico que Firebase usa tanto para falta de
        // permiso como para violar cualquier otra condición de la regla (ej. tamaño) — no
        // hay forma de distinguirlos desde el cliente, así que el mensaje cubre ambos casos.
        const reason = err.code === 'storage/unauthorized'
          ? 'sin permiso o el archivo supera el límite de 20MB'
          : (err.code || err.message || 'error desconocido')
        toast.error(`No se pudo subir "${file.name}" (${reason})`)
        setAttachments((list) => list.filter((a) => a.id !== tempId))
      }
    }
    input.click()
  }

  const removeAttachment = (id) => setAttachments((list) => list.filter((a) => a.id !== id))

  const handleDrivePicked = ({ name, url }) => {
    // Se inserta como nodo estructurado (no como string HTML concatenado): el nombre del
    // archivo viene de Drive sin validar y podría tener cualquier contenido (alguien podría
    // compartir un archivo con el nombre armado a propósito) — así Tiptap lo trata siempre
    // como texto/atributo, nunca como markup, sin necesidad de escapar a mano.
    editor?.chain().focus().insertContent({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: `📎 ${name}`,
        marks: [{ type: 'link', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } }],
      }],
    }).run()
    toast.success(`Link a "${name}" insertado en el mensaje`)
  }

  const handleSend = async () => {
    if (!fromAccountId) { toast.error('Elegí desde qué cuenta enviar'); return }
    if (!toValue.trim()) { toast.error('Falta el destinatario'); return }
    if (!subject.trim()) { toast.error('Falta el asunto'); return }
    if (attachments.some((a) => a.uploading)) { toast.error('Esperá a que terminen de subir los adjuntos'); return }

    setSending(true)
    try {
      const htmlBody = htmlSourceOverride != null ? htmlSourceOverride : (editor?.getHTML() || '')
      await sendEmail({
        fromAccountId,
        to: toValue.trim(),
        subject: subject.trim(),
        htmlBody,
        attachments: attachments.map(({ filename, path, mimeType }) => ({ filename, path, mimeType })),
        leadId,
      })
      toast.success('Email enviado')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al enviar el email')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text">Nuevo email</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {accounts.length === 0 ? (
            <div className="text-sm text-brand-text-muted bg-brand-bg-2 border border-brand-border rounded-lg px-3 py-2.5">
              No hay ninguna cuenta de Gmail conectada. Andá a <span className="font-medium">Mailing</span> en el menú para conectar una antes de enviar.
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

          <div>
            <label className="label">Para</label>
            <input className="input-field" value={toValue} onChange={(e) => setToValue(e.target.value)} placeholder="destinatario@ejemplo.com" />
          </div>

          {templates.length > 0 && (
            <div>
              <label className="label">Plantilla</label>
              <select className="select-field" defaultValue="" onChange={(e) => handlePickTemplate(e.target.value)}>
                <option value="">Escribir desde cero</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="text-xs text-brand-text-light mt-1">
                Si la plantilla tiene <code>{'{{nombre}}'}</code>/<code>{'{{empresa}}'}</code>, acá no se reemplazan automáticamente — son para envío masivo.
              </p>
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
                <EmailEditorToolbar editor={editor} onPickImage={handlePickImage} />
                <div className="mail-editor-content px-3 py-2.5 max-h-64 overflow-y-auto" onClick={() => editor?.chain().focus().run()}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePickAttachment} className="btn-ghost text-xs px-2 py-1.5">
                <Paperclip size={14} /> Adjuntar archivo
              </button>
              <DriveAttachButton onPicked={handleDrivePicked} />
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-brand-bg-2 border border-brand-border rounded-lg text-xs text-brand-text">
                    <FileText size={12} className="flex-shrink-0" />
                    <span className="max-w-[140px] truncate">{a.filename}</span>
                    {a.uploading ? (
                      <Loader2 size={12} className="animate-spin text-brand-text-muted" />
                    ) : (
                      <button type="button" onClick={() => removeAttachment(a.id)} className="p-0.5 rounded hover:bg-brand-bg-3">
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-brand-border">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="button" onClick={handleSend} disabled={sending || accounts.length === 0} className="btn-primary">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
