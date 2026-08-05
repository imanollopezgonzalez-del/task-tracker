import { useState } from 'react'
import { X, Loader2, Type } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { createMailTemplate, updateMailTemplate } from '../../services/mailing'
import { useMailEditor, EmailEditorToolbar, EditorContent } from './EmailBodyEditor'

export default function TemplateModal({ template = null, onClose }) {
  const { userProfile, currentUser } = useAuth()
  const companyId = userProfile?.companyId
  const isEdit = !!template

  const [name, setName] = useState(template?.name || '')
  const [subject, setSubject] = useState(template?.subject || '')
  const [mode, setMode] = useState(template?.mode || 'rich')
  const [htmlSource, setHtmlSource] = useState(template?.htmlSource || '')
  const [saving, setSaving] = useState(false)

  const { editor, handlePickImage } = useMailEditor({ companyId, content: template?.richBodyHtml || '' })

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Falta el nombre de la plantilla'); return }
    if (!subject.trim()) { toast.error('Falta el asunto'); return }
    const body = mode === 'rich' ? (editor?.getHTML() || '') : htmlSource
    // El HTML "vacío" de Tiptap es "<p></p>", que no es "" y pasa un chequeo con .trim().
    // Usamos editor.isEmpty para detectar de verdad un documento vacío (evita pisar un
    // htmlSource con contenido real si el usuario toca "Editor visual" por error).
    const isEmpty = mode === 'rich' ? (editor?.isEmpty ?? true) : !htmlSource.trim()
    if (isEmpty) { toast.error('Falta el contenido del email'); return }

    setSaving(true)
    try {
      const data = { name: name.trim(), subject: subject.trim(), mode, body }
      if (isEdit) {
        await updateMailTemplate(template.id, data)
        toast.success('Plantilla actualizada')
      } else {
        await createMailTemplate(companyId, currentUser.uid, data)
        toast.success('Plantilla creada')
      }
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar la plantilla')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text">{isEdit ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          <div>
            <label className="label">Nombre interno</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Ravioles de Espinaca" />
          </div>

          <div>
            <label className="label">Asunto</label>
            <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={() => setMode('rich')}
              className={`px-3 py-1.5 rounded-lg font-medium border ${mode === 'rich' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-text-muted border-brand-border'}`}>
              Editor visual
            </button>
            <button type="button" onClick={() => setMode('html')}
              className={`px-3 py-1.5 rounded-lg font-medium border ${mode === 'html' ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-brand-text-muted border-brand-border'}`}>
              Pegar HTML
            </button>
          </div>

          {mode === 'rich' ? (
            <div>
              <label className="label">Mensaje</label>
              <div className="border border-brand-border rounded-lg overflow-hidden">
                <EmailEditorToolbar editor={editor} onPickImage={handlePickImage} mergeFields />
                <div className="mail-editor-content px-3 py-2.5 max-h-64 overflow-y-auto" onClick={() => editor?.chain().focus().run()}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="label flex items-center gap-1.5">
                HTML del email
                <span className="text-brand-text-light font-normal">— usá vos mismo <code>{'{{nombre}}'}</code> / <code>{'{{empresa}}'}</code> donde quieras personalizar</span>
              </label>
              <textarea
                className="input-field font-mono text-xs h-64 resize-y"
                value={htmlSource}
                onChange={(e) => setHtmlSource(e.target.value)}
                placeholder="<html>...</html>"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-brand-border">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Type size={15} />}
            {saving ? 'Guardando...' : 'Guardar plantilla'}
          </button>
        </div>
      </div>
    </div>
  )
}
