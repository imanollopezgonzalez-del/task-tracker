import { useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  List, ListOrdered, Image as ImageIcon, Type,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadMailingImage } from '../../services/mailing'

export { EditorContent }

export function useMailEditor({ companyId, content = '' } = {}) {
  const uploadImage = useCallback(async (file) => {
    const toastId = toast.loading('Subiendo imagen...')
    try {
      const url = await uploadMailingImage(companyId, file)
      editor?.chain().focus().setImage({ src: url }).run()
      toast.success('Imagen agregada', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Error al subir la imagen', { id: toastId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      ImageExtension,
      Placeholder.configure({ placeholder: 'Escribí tu mensaje...' }),
    ],
    content,
    editorProps: {
      attributes: { class: 'mail-editor-content-inner' },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find((i) => i.type.startsWith('image/'))
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (file) uploadImage(file)
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        const file = event.dataTransfer?.files?.[0]
        if (file?.type.startsWith('image/')) {
          event.preventDefault()
          uploadImage(file)
          return true
        }
        return false
      },
    },
  })

  const handlePickImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) uploadImage(file)
    }
    input.click()
  }

  return { editor, handlePickImage }
}

export function EmailEditorToolbar({ editor, onPickImage, mergeFields = false }) {
  if (!editor) return null

  const setLink = () => {
    const previous = editor.getAttributes('link').href
    const url = window.prompt('URL del link:', previous || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertToken = (token) => editor.chain().focus().insertContent(token).run()

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-brand-border bg-brand-bg flex-wrap">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
        className={`mail-editor-toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`} title="Negrita">
        <Bold size={15} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`mail-editor-toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`} title="Cursiva">
        <Italic size={15} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`mail-editor-toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`} title="Subrayado">
        <UnderlineIcon size={15} />
      </button>
      <div className="w-px h-4 bg-brand-border mx-1" />
      <button type="button" onClick={setLink}
        className={`mail-editor-toolbar-btn ${editor.isActive('link') ? 'is-active' : ''}`} title="Link">
        <LinkIcon size={15} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`mail-editor-toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`} title="Lista">
        <List size={15} />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`mail-editor-toolbar-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`} title="Lista numerada">
        <ListOrdered size={15} />
      </button>
      <div className="w-px h-4 bg-brand-border mx-1" />
      <button type="button" onClick={onPickImage} className="mail-editor-toolbar-btn" title="Insertar imagen">
        <ImageIcon size={15} />
      </button>
      {mergeFields && (
        <>
          <div className="w-px h-4 bg-brand-border mx-1" />
          <button type="button" onClick={() => insertToken('{{nombre}}')}
            className="mail-editor-toolbar-btn flex items-center gap-1 text-xs px-2" title="Insertar nombre del contacto">
            <Type size={13} /> Nombre
          </button>
          <button type="button" onClick={() => insertToken('{{empresa}}')}
            className="mail-editor-toolbar-btn flex items-center gap-1 text-xs px-2" title="Insertar nombre de la empresa">
            <Type size={13} /> Empresa
          </button>
        </>
      )}
    </div>
  )
}
