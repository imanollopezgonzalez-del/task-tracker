# Envío masivo, plantillas y campañas de Mailing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar plantillas reutilizables (con campos `{{nombre}}`/`{{empresa}}`), envío masivo con los filtros ya existentes de Leads/Contactos/Clientes, y un historial de campañas unificado (individual + masivo), todo dentro de la página `/crm/mailing` ya existente.

**Architecture:** React 19 + Firestore (colecciones nuevas `mailTemplates` y `mailCampaigns`) + una nueva Cloud Function `sendBulkMail` que reusa la infraestructura de OAuth/Gmail ya existente en `functions/mailing.js`. Sin rutas nuevas — todo vive en `src/pages/crm/Mailing.jsx`.

**Tech Stack:** React, Tailwind, Firebase (Firestore + Functions v2 + Storage), Tiptap (editor de texto enriquecido), Gmail API vía `googleapis`.

## Global Constraints

- Todo dentro de `/crm/mailing`, sin páginas/rutas nuevas (decisión explícita del usuario).
- Campos de fusión: únicamente `{{nombre}}` (persona de contacto) y `{{empresa}}` (nombre de la empresa) — reemplazo de texto simple, sin motor de templating.
- Envío masivo: siempre "mandar ahora", sin programación de fecha/hora (Fase 1).
- Tope de 500 destinatarios por envío masivo (límite diario de Gmail en cuenta personal), validado en cliente Y en el servidor.
- Un email por destinatario (no CC/BCC masivo) — mejor entregabilidad y permite personalización.
- Tracking de apertura/clic/baja de suscripción: **fuera de alcance**, diferido a Fase 2 (ver spec).
- Sin suite de tests automatizada en este repo — verificación por `npx vite build` + prueba manual end-to-end, siguiendo la convención ya establecida en este proyecto.
- Node 20 en `functions/` (runtime actual del proyecto, ver `functions/package.json`).
- Reusar exactamente los mismos campos de filtro que ya existen en `Leads.jsx`/`Contactos.jsx`/`Clientes.jsx` (`tipoCliente`, `producto`, `responsable`, y en Clientes también el segmento nuevos/antiguos/perdidos).

**Spec de referencia:** `docs/superpowers/specs/2026-08-05-mailing-masivo-design.md`

---

## File Structure

**Nuevos:**
- `src/utils/mailingAudience.js` — funciones puras para filtrar la audiencia (Leads/Contactos/Clientes) y resolver email/nombre/empresa de un registro.
- `src/components/mailing/EmailBodyEditor.jsx` — hook `useMailEditor` + componente `EmailEditorToolbar`, extraídos de `ComposeEmailModal.jsx` para reusar en 3 lugares.
- `src/components/mailing/TemplateModal.jsx` — crear/editar una plantilla (modo editor visual o pegar HTML).
- `src/components/mailing/BulkSendPanel.jsx` — selector de audiencia + compositor + envío masivo.
- `src/components/mailing/CampaignDetail.jsx` — panel de detalle de una campaña (métricas + lista de destinatarios).

**Modificados:**
- `firestore.rules` — reglas de `mailTemplates` y `mailCampaigns`.
- `functions/mailing.js` — `sendMail` crea una `mailCampaign`; nueva función `sendBulkMail`.
- `functions/index.js` — exporta `sendBulkMail`.
- `src/services/mailing.js` — CRUD de plantillas, `sendBulkEmail`, queries de campañas.
- `src/components/mailing/ComposeEmailModal.jsx` — usa el editor compartido; agrega selector "Usar plantilla".
- `src/pages/crm/Mailing.jsx` — agrega secciones "Plantillas" y "Envío masivo"; reemplaza el historial plano por campañas agrupadas.

---

### Task 1: Reglas de Firestore para `mailTemplates` y `mailCampaigns`

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: colecciones `mailTemplates` (lectura/escritura cliente) y `mailCampaigns` (solo lectura cliente) accesibles para usuarios con `hasCrm()` de la misma empresa.

- [ ] **Step 1: Agregar las reglas nuevas**

En `firestore.rules`, dentro de `service cloud.firestore { match /databases/{database}/documents {`, justo después del bloque de `mailingLogs` (antes del `}` que cierra `documents`), agregar:

```
    match /mailTemplates/{templateId} {
      allow read: if hasCrm() && myCompany() == resource.data.companyId;
      allow create: if hasCrm() && myCompany() == request.resource.data.companyId;
      allow update, delete: if hasCrm() && myCompany() == resource.data.companyId;
    }

    match /mailCampaigns/{campaignId} {
      allow read: if hasCrm() && myCompany() == resource.data.companyId;
      allow create, update, delete: if false; // solo Cloud Functions (Admin SDK)
    }
```

- [ ] **Step 2: Verificar que el archivo compila y deployar**

Run:
```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx firebase-tools deploy --project gestion-tareas-pariggi --only firestore:rules --non-interactive
```
Expected: `+  firestore: released rules firestore.rules to cloud.firestore` sin errores.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(mailing): agregar reglas de Firestore para mailTemplates y mailCampaigns"
git push origin main
```

---

### Task 2: Extraer el editor de email a un componente compartido

Refactor puro — sin cambio de comportamiento. `ComposeEmailModal` debe verse y funcionar exactamente igual después de este task.

**Files:**
- Create: `src/components/mailing/EmailBodyEditor.jsx`
- Modify: `src/components/mailing/ComposeEmailModal.jsx`

**Interfaces:**
- Produces: `useMailEditor({ companyId, content? }) => { editor, handlePickImage }` y `<EmailEditorToolbar editor onPickImage mergeFields? />`, usados por `ComposeEmailModal` en este task, y por `TemplateModal`/`BulkSendPanel` en tasks posteriores.

- [ ] **Step 1: Crear `EmailBodyEditor.jsx`**

```jsx
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
```

- [ ] **Step 2: Reemplazar el editor inline en `ComposeEmailModal.jsx` por el compartido**

Reemplazar el import de tiptap y el bloque `function Toolbar(...)` (líneas 1-61 del archivo actual) por:

```jsx
import { useState, useEffect, useCallback } from 'react'
import {
  X, Paperclip, Send, Loader2, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeConnectedAccounts, sendEmail, uploadMailingAttachment } from '../../services/mailing'
import { useMailEditor, EmailEditorToolbar, EditorContent } from './EmailBodyEditor'
```

- [ ] **Step 3: Usar el hook dentro del componente**

Dentro de `export default function ComposeEmailModal(...)`, eliminar el bloque `const uploadImage = useCallback(...)` y el bloque `const editor = useEditor({...})` (lo que hoy son las líneas 83-125), y reemplazarlos por:

```jsx
  const { editor, handlePickImage } = useMailEditor({ companyId })
```

Eliminar también la función `handlePickImage` que quedaba definida más abajo (ya la devuelve el hook).

- [ ] **Step 4: Actualizar el JSX del editor**

Donde dice:
```jsx
              <Toolbar editor={editor} onPickImage={handlePickImage} />
```
Reemplazar por:
```jsx
              <EmailEditorToolbar editor={editor} onPickImage={handlePickImage} />
```

- [ ] **Step 5: Build y prueba de regresión manual**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx vite build
```
Expected: build sin errores.

Manual: abrir la app, ir a un Lead/Contacto/Cliente, click "Nuevo email", confirmar que el editor (negrita, cursiva, links, listas, imagen por botón/paste/drag) funciona igual que antes.

- [ ] **Step 6: Commit**

```bash
git add src/components/mailing/EmailBodyEditor.jsx src/components/mailing/ComposeEmailModal.jsx
git commit -m "refactor(mailing): extraer editor de email a componente compartido"
git push origin main
```

---

### Task 3: Backend — `sendMail` crea una `mailCampaign` + helpers compartidos

**Files:**
- Modify: `functions/mailing.js`

**Interfaces:**
- Produces: `createMailCampaign(db, fields)`, `bumpCampaignCounter(db, campaignId, field)`, `finishCampaign(db, campaignId)` — usados también por `sendBulkMail` en el Task 4.

- [ ] **Step 1: Agregar la constante de colección y los helpers**

Después de la línea `const MAILING_LOGS_COL = 'mailingLogs'`, agregar:

```js
const MAILING_CAMPAIGNS_COL = 'mailCampaigns'

async function createMailCampaign(db, {
  companyId, subject, fromAccountId, fromEmail, sentBy, sentByName,
  templateId, audienceType, recipientCount,
}) {
  const ref = await db.collection(MAILING_CAMPAIGNS_COL).add({
    companyId, subject, fromAccountId, fromEmail, sentBy, sentByName,
    templateId: templateId || null,
    audienceType: audienceType || 'individual',
    recipientCount,
    sentCount: 0,
    failedCount: 0,
    status: 'sending',
    createdAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

async function bumpCampaignCounter(db, campaignId, field) {
  await db.doc(`${MAILING_CAMPAIGNS_COL}/${campaignId}`).update({ [field]: FieldValue.increment(1) })
}

async function finishCampaign(db, campaignId) {
  await db.doc(`${MAILING_CAMPAIGNS_COL}/${campaignId}`).update({ status: 'done' })
}
```

- [ ] **Step 2: Reemplazar el cuerpo de `sendMail`**

Reemplazar la función `sendMail` completa (desde `const sendMail = onCall(...)` hasta el `})` que la cierra) por:

```js
const sendMail = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET], timeoutSeconds: 60 }, async (request) => {
  const caller = await requireCrmUser(request.auth?.uid)
  const { fromAccountId, to, subject, htmlBody, attachments, leadId } = request.data || {}

  if (!fromAccountId || !to || !subject || !htmlBody) {
    throw new HttpsError('invalid-argument', 'Faltan datos del email (cuenta, destinatario, asunto o cuerpo)')
  }

  const db = getFirestore()
  const tokenRef = db.doc(`${MAILING_TOKENS_COL}/${fromAccountId}`)
  const tokenSnap = await tokenRef.get()
  if (!tokenSnap.exists || tokenSnap.data().companyId !== caller.companyId) {
    throw new HttpsError('permission-denied', 'La cuenta de envío no es válida')
  }
  const { refreshToken, email: fromEmail } = tokenSnap.data()

  const oauth2Client = createOAuth2Client(GOOGLE_OAUTH_CLIENT_SECRET.value())
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const campaignId = await createMailCampaign(db, {
    companyId: caller.companyId, subject, fromAccountId, fromEmail,
    sentBy: caller.uid, sentByName: caller.displayName,
    audienceType: 'individual', recipientCount: 1,
  })

  const logBase = {
    companyId: caller.companyId,
    fromAccountId,
    fromEmail,
    to,
    subject,
    htmlBody,
    hasAttachments: Array.isArray(attachments) && attachments.length > 0,
    leadId: leadId || null,
    campaignId,
    sentBy: caller.uid,
    sentByName: caller.displayName,
    createdAt: FieldValue.serverTimestamp(),
  }

  const fail = async (errorMessage) => {
    await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage })
    await bumpCampaignCounter(db, campaignId, 'failedCount')
    await finishCampaign(db, campaignId)
  }

  try {
    await oauth2Client.refreshAccessToken()
  } catch (err) {
    console.error('sendMail: refreshAccessToken failed', err.message)
    await fail('reauth_required')
    const settingsRef = db.doc(`${MAILING_SETTINGS_COL}/${caller.companyId}`)
    const settingsSnap = await settingsRef.get()
    if (settingsSnap.exists) {
      const connectedAccounts = (settingsSnap.data().connectedAccounts || []).map((a) =>
        a.id === fromAccountId ? { ...a, status: 'reauth_required' } : a
      )
      await settingsRef.set({ connectedAccounts }, { merge: true })
    }
    throw new HttpsError('failed-precondition', 'La cuenta de Gmail necesita reconectarse desde /crm/mailing')
  }

  // Leer attachments directo de Storage por path (ya subidos por el frontend).
  // No se acepta una URL arbitraria del cliente para fetch server-side (evita SSRF):
  // el path se valida contra la carpeta de adjuntos de la propia empresa.
  const attachmentsPrefix = `mailing/${caller.companyId}/attachments/`
  const bucket = getStorage().bucket()
  const mailAttachments = []
  for (const att of attachments || []) {
    if (typeof att.path !== 'string' || !att.path.startsWith(attachmentsPrefix)) {
      await fail('invalid_attachment')
      throw new HttpsError('invalid-argument', `Adjunto inválido: "${att.filename}"`)
    }
    try {
      const [buffer] = await bucket.file(att.path).download()
      mailAttachments.push({ filename: att.filename, content: buffer, contentType: att.mimeType })
    } catch (err) {
      console.error('sendMail: no se pudo leer adjunto', att.filename, err.message)
      await fail('attachment_read_failed')
      throw new HttpsError('internal', `No se pudo adjuntar el archivo "${att.filename}"`)
    }
  }

  let raw
  try {
    const mail = new MailComposer({
      from: fromEmail,
      to,
      subject,
      html: htmlBody,
      attachments: mailAttachments,
    })
    const mimeMessage = await new Promise((resolve, reject) => {
      mail.compile().build((err, message) => (err ? reject(err) : resolve(message)))
    })
    raw = mimeMessage.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  } catch (err) {
    console.error('sendMail: MIME build failed', err)
    await fail('mime_build_failed')
    throw new HttpsError('internal', 'No se pudo armar el email')
  }

  let gmailMessageId
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    gmailMessageId = res.data.id
  } catch (err) {
    console.error('sendMail: gmail send failed', err)
    await fail('gmail_send_failed')
    throw new HttpsError('internal', 'Gmail rechazó el envío del email')
  }

  const logRef = await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'sent', gmailMessageId })
  await bumpCampaignCounter(db, campaignId, 'sentCount')
  await finishCampaign(db, campaignId)

  return { ok: true, logId: logRef.id, gmailMessageId, campaignId }
})
```

- [ ] **Step 3: Verificar sintaxis y deployar**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS\functions"
node --check mailing.js
cd ..
npx firebase-tools deploy --project gestion-tareas-pariggi --only functions:sendMail --non-interactive
```
Expected: `functions[sendMail(us-central1)] Successful update operation.`

- [ ] **Step 4: Prueba manual end-to-end**

En la app, mandar un email individual de prueba (botón "Nuevo email" desde un Lead/Contacto/Cliente). Confirmar en la consola de Firestore (`console.firebase.google.com/project/gestion-tareas-pariggi/firestore`) que:
- Se creó un documento en `mailCampaigns` con `recipientCount: 1`, `sentCount: 1`, `status: 'done'`.
- El documento correspondiente en `mailingLogs` tiene `campaignId` apuntando a ese mismo documento.

- [ ] **Step 5: Commit**

```bash
git add functions/mailing.js
git commit -m "feat(mailing): sendMail crea una mailCampaign para unificar el historial"
git push origin main
```

---

### Task 4: Backend — `sendBulkMail`

**Files:**
- Modify: `functions/mailing.js`
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `createMailCampaign`, `bumpCampaignCounter`, `finishCampaign` (Task 3).
- Produces: Cloud Function callable `sendBulkMail(data)` con `data = { fromAccountId, subject, htmlBody, recipients: [{ email, nombre, empresa, leadId }], attachments?, templateId?, audienceType? }`, retorna `{ ok: true, campaignId }`.

- [ ] **Step 1: Agregar `sendBulkMail` a `functions/mailing.js`**

Al final del archivo, antes de `module.exports = { connectGmailAccount, disconnectGmailAccount, sendMail }`, agregar:

```js
// ---------------------------------------------------------------------------
// sendBulkMail
// ---------------------------------------------------------------------------
function applyMergeFields(text, { nombre, empresa }) {
  return (text || '')
    .replaceAll('{{nombre}}', nombre || '')
    .replaceAll('{{empresa}}', empresa || '')
}

const MAX_BULK_RECIPIENTS = 500

const sendBulkMail = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET], timeoutSeconds: 540 }, async (request) => {
  const caller = await requireCrmUser(request.auth?.uid)
  const { fromAccountId, subject, htmlBody, recipients, attachments, templateId, audienceType } = request.data || {}

  if (!fromAccountId || !subject || !htmlBody || !Array.isArray(recipients) || recipients.length === 0) {
    throw new HttpsError('invalid-argument', 'Faltan datos del envío masivo (cuenta, asunto, cuerpo o destinatarios)')
  }
  if (recipients.length > MAX_BULK_RECIPIENTS) {
    throw new HttpsError('invalid-argument', `El envío masivo admite hasta ${MAX_BULK_RECIPIENTS} destinatarios (se recibieron ${recipients.length})`)
  }
  for (const r of recipients) {
    if (typeof r?.email !== 'string' || !r.email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Hay un destinatario sin email válido')
    }
  }

  const db = getFirestore()
  const tokenRef = db.doc(`${MAILING_TOKENS_COL}/${fromAccountId}`)
  const tokenSnap = await tokenRef.get()
  if (!tokenSnap.exists || tokenSnap.data().companyId !== caller.companyId) {
    throw new HttpsError('permission-denied', 'La cuenta de envío no es válida')
  }
  const { refreshToken, email: fromEmail } = tokenSnap.data()

  const oauth2Client = createOAuth2Client(GOOGLE_OAUTH_CLIENT_SECRET.value())
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  try {
    await oauth2Client.refreshAccessToken()
  } catch (err) {
    console.error('sendBulkMail: refreshAccessToken failed', err.message)
    throw new HttpsError('failed-precondition', 'La cuenta de Gmail necesita reconectarse desde /crm/mailing')
  }

  // Adjuntos: se descargan una sola vez de Storage y se reusan en cada envío individual
  const attachmentsPrefix = `mailing/${caller.companyId}/attachments/`
  const bucket = getStorage().bucket()
  const mailAttachments = []
  for (const att of attachments || []) {
    if (typeof att.path !== 'string' || !att.path.startsWith(attachmentsPrefix)) {
      throw new HttpsError('invalid-argument', `Adjunto inválido: "${att.filename}"`)
    }
    try {
      const [buffer] = await bucket.file(att.path).download()
      mailAttachments.push({ filename: att.filename, content: buffer, contentType: att.mimeType })
    } catch (err) {
      console.error('sendBulkMail: no se pudo leer adjunto', att.filename, err.message)
      throw new HttpsError('internal', `No se pudo adjuntar el archivo "${att.filename}"`)
    }
  }

  const campaignId = await createMailCampaign(db, {
    companyId: caller.companyId, subject, fromAccountId, fromEmail,
    sentBy: caller.uid, sentByName: caller.displayName,
    templateId, audienceType, recipientCount: recipients.length,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  for (const recipient of recipients) {
    const personalizedSubject = applyMergeFields(subject, recipient)
    const personalizedBody = applyMergeFields(htmlBody, recipient)
    const logBase = {
      companyId: caller.companyId,
      fromAccountId,
      fromEmail,
      to: recipient.email,
      subject: personalizedSubject,
      htmlBody: personalizedBody,
      hasAttachments: mailAttachments.length > 0,
      leadId: recipient.leadId || null,
      campaignId,
      sentBy: caller.uid,
      sentByName: caller.displayName,
      createdAt: FieldValue.serverTimestamp(),
    }

    try {
      const mail = new MailComposer({
        from: fromEmail,
        to: recipient.email,
        subject: personalizedSubject,
        html: personalizedBody,
        attachments: mailAttachments,
      })
      const mimeMessage = await new Promise((resolve, reject) => {
        mail.compile().build((err, message) => (err ? reject(err) : resolve(message)))
      })
      const raw = mimeMessage.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
      await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'sent', gmailMessageId: res.data.id })
      await bumpCampaignCounter(db, campaignId, 'sentCount')
    } catch (err) {
      console.error('sendBulkMail: fallo el envío a', recipient.email, err.message)
      await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage: err.message || 'send_failed' })
      await bumpCampaignCounter(db, campaignId, 'failedCount')
    }
  }

  await finishCampaign(db, campaignId)

  return { ok: true, campaignId }
})
```

- [ ] **Step 2: Exportar la función**

En `functions/mailing.js`, cambiar la última línea a:
```js
module.exports = { connectGmailAccount, disconnectGmailAccount, sendMail, sendBulkMail }
```

En `functions/index.js`, reemplazar el contenido por:
```js
const { initializeApp } = require('firebase-admin/app')

initializeApp()

const { connectGmailAccount, disconnectGmailAccount, sendMail, sendBulkMail } = require('./mailing')

exports.connectGmailAccount = connectGmailAccount
exports.disconnectGmailAccount = disconnectGmailAccount
exports.sendMail = sendMail
exports.sendBulkMail = sendBulkMail
```

- [ ] **Step 3: Verificar sintaxis y deployar**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS\functions"
node --check mailing.js
node --check index.js
cd ..
npx firebase-tools deploy --project gestion-tareas-pariggi --only functions --non-interactive
```
Expected: `functions[sendBulkMail(us-central1)] Successful create operation.` (y `sendMail` como update).

- [ ] **Step 4: Confirmar que la función está activa**

Usar la tool MCP `mcp__firebase__functions_list_functions` (o `npx firebase-tools functions:list --project gestion-tareas-pariggi`) y confirmar que `sendBulkMail` aparece con `trigger: callable`. La prueba end-to-end completa se hace en el Task 7, una vez que exista el frontend que la invoca.

- [ ] **Step 5: Commit**

```bash
git add functions/mailing.js functions/index.js
git commit -m "feat(mailing): agregar Cloud Function sendBulkMail para envio masivo"
git push origin main
```

---

### Task 5: Plantillas — servicio CRUD, `TemplateModal` y sección "Plantillas"

**Files:**
- Modify: `src/services/mailing.js`
- Create: `src/components/mailing/TemplateModal.jsx`
- Modify: `src/pages/crm/Mailing.jsx`

**Interfaces:**
- Consumes: `useMailEditor`, `EmailEditorToolbar`, `EditorContent` (Task 2).
- Produces: `subscribeMailTemplates(companyId, cb)`, `createMailTemplate(companyId, uid, data)`, `updateMailTemplate(templateId, data)`, `deleteMailTemplate(templateId)`, con `data = { name, subject, mode: 'rich'|'html', body }`. Documentos con forma `{ id, name, subject, mode, richBodyHtml, htmlSource, ... }`, consumidos por `BulkSendPanel` (Task 7) y `ComposeEmailModal` (Task 7).

- [ ] **Step 1: Agregar el CRUD de plantillas a `src/services/mailing.js`**

Cambiar el import de Firestore (primera línea del archivo) a:
```js
import { db, functions, storage } from '../firebase'
import { doc, onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const MAILING_SETTINGS_COL = 'mailingSettings'
const MAILING_LOGS_COL = 'mailingLogs'
const MAIL_TEMPLATES_COL = 'mailTemplates'
```

Al final del archivo, agregar:

```js
export const subscribeMailTemplates = (companyId, callback) => {
  const q = query(collection(db, MAIL_TEMPLATES_COL), where('companyId', '==', companyId))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('subscribeMailTemplates error:', err)
  )
}

export const createMailTemplate = async (companyId, uid, { name, subject, mode, body }) => {
  await addDoc(collection(db, MAIL_TEMPLATES_COL), {
    companyId,
    createdBy: uid,
    name,
    subject,
    mode,
    richBodyHtml: mode === 'rich' ? body : null,
    htmlSource: mode === 'html' ? body : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const updateMailTemplate = async (templateId, { name, subject, mode, body }) => {
  await updateDoc(doc(db, MAIL_TEMPLATES_COL, templateId), {
    name,
    subject,
    mode,
    richBodyHtml: mode === 'rich' ? body : null,
    htmlSource: mode === 'html' ? body : null,
    updatedAt: serverTimestamp(),
  })
}

export const deleteMailTemplate = async (templateId) => {
  await deleteDoc(doc(db, MAIL_TEMPLATES_COL, templateId))
}
```

- [ ] **Step 2: Crear `TemplateModal.jsx`**

```jsx
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
    if (!body.trim()) { toast.error('Falta el contenido del email'); return }

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
```

- [ ] **Step 3: Agregar la sección "Plantillas" a `Mailing.jsx`**

Agregar el import, junto a los demás imports de servicios:
```jsx
import { subscribeMailTemplates, deleteMailTemplate } from '../../services/mailing'
import TemplateModal from '../../components/mailing/TemplateModal'
import { Pencil, Trash2 as TrashIcon, FileType } from 'lucide-react'
```
(Nota: `Trash2` ya está importado para las cuentas conectadas — usar el alias `TrashIcon` únicamente si hace falta evitar colisión; si el linter no protesta por reimportar el mismo ícono dos veces con distinto nombre, usar directamente `Trash2` en ambos lugares y omitir el alias.)

Dentro de `export default function Mailing()`, agregar el estado:
```jsx
  const [templates, setTemplates] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
```

Agregar el efecto de suscripción, junto a los otros `useEffect`:
```jsx
  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailTemplates(companyId, setTemplates)
    return unsub
  }, [companyId])
```

Agregar el handler de borrado, junto a `handleDisconnect`:
```jsx
  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    try {
      await deleteMailTemplate(templateId)
      toast.success('Plantilla eliminada')
    } catch (err) {
      toast.error('Error al eliminar la plantilla')
    }
  }
```

En el JSX, después del `</div>` que cierra la sección "Cuentas conectadas" y antes de la sección "Historial de envíos", agregar:

```jsx
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-text">Plantillas</h2>
            <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true) }} className="btn-primary text-xs px-3 py-1.5">
              <FileType size={14} /> Nueva plantilla
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no creaste ninguna plantilla.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border border-brand-border rounded-xl bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-text truncate">{t.name}</p>
                    <p className="text-xs text-brand-text-muted truncate">{t.subject}</p>
                  </div>
                  <span className="badge bg-brand-bg-2 text-brand-text-muted flex-shrink-0">
                    {t.mode === 'html' ? 'HTML' : 'Visual'}
                  </span>
                  <button onClick={() => { setEditingTemplate(t); setShowTemplateModal(true) }} className="btn-ghost text-xs px-2 py-1.5 flex-shrink-0">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="btn-ghost text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 flex-shrink-0">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
```

Y, justo antes del cierre `</div>` final del componente (antes de `{showCompose && ...}`), agregar:
```jsx
      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null) }}
        />
      )}
```

- [ ] **Step 4: Build**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx vite build
```
Expected: sin errores.

- [ ] **Step 5: Prueba manual**

Crear una plantilla en modo "Editor visual" (con texto + botones Nombre/Empresa insertando los tags), y otra en modo "Pegar HTML" (pegar el contenido de `HTML MAILING RAVIOLES ESPINACA 2.txt` como prueba real). Editar una, eliminar la otra. Confirmar que persisten al recargar la página (F5).

- [ ] **Step 6: Commit**

```bash
git add src/services/mailing.js src/components/mailing/TemplateModal.jsx src/pages/crm/Mailing.jsx
git commit -m "feat(mailing): agregar CRUD de plantillas reutilizables"
git push origin main
```

---

### Task 6: Utilidades de audiencia (`mailingAudience.js`)

Lógica pura, sin UI — testeable por separado antes de construir el panel de envío masivo.

**Files:**
- Create: `src/utils/mailingAudience.js`

**Interfaces:**
- Produces: `AUDIENCE_TYPES`, `CLIENTE_SEGMENTOS`, `filterAudience(records, filters)`, `resolveRecipient(record)` — usados por `BulkSendPanel` (Task 7).

- [ ] **Step 1: Crear el archivo**

```js
import { getResponsables } from './crmHelpers'

const currentYear = new Date().getFullYear()

function getAnoAlta(c) {
  if (c.anoAlta) return c.anoAlta
  if (c.fechaCierre) return new Date(c.fechaCierre + 'T12:00:00').getFullYear()
  return currentYear
}

export const AUDIENCE_TYPES = [
  { key: 'leads', label: 'Leads' },
  { key: 'contactos', label: 'Contactos' },
  { key: 'clientes', label: 'Clientes' },
]

export const CLIENTE_SEGMENTOS = [
  { key: 'nuevos', label: 'Clientes nuevos' },
  { key: 'antiguos', label: 'Clientes antiguos' },
  { key: 'perdidos', label: 'Clientes perdidos' },
]

function baseByType(records, audienceType) {
  if (audienceType === 'leads') {
    return records.filter((l) => !(l.esCliente || (l.registroTipo && l.registroTipo !== 'lead')))
  }
  if (audienceType === 'contactos') {
    return records.filter((l) => l.registroTipo === 'contacto' || (l.esCliente === true && !l.registroTipo))
  }
  if (audienceType === 'clientes') {
    return records.filter((l) => l.registroTipo === 'cliente')
  }
  return []
}

function clienteSegmento(c) {
  if (c.clienteEstado === 'perdido') return 'perdidos'
  return getAnoAlta(c) < currentYear ? 'antiguos' : 'nuevos'
}

// Filtra la colección `leads` (sirve leads/contactos/clientes, diferenciados por registroTipo)
// con el mismo criterio de tipo/producto/responsable ya usado en Leads/Contactos/Clientes.
export function filterAudience(records, { audienceType, tipo, producto, responsable, segmentos }) {
  let result = baseByType(records, audienceType)
  if (audienceType === 'clientes' && segmentos?.length) {
    result = result.filter((c) => segmentos.includes(clienteSegmento(c)))
  }
  if (tipo) result = result.filter((r) => r.tipoCliente === tipo)
  if (producto) result = result.filter((r) => r.producto === producto)
  if (responsable) result = result.filter((r) => getResponsables(r).includes(responsable))
  return result
}

// Resuelve email/nombre/empresa de un registro (mismo fallback que las fichas de detalle).
// Devuelve null si no tiene ningún email cargado — ese registro se excluye del envío.
export function resolveRecipient(record) {
  const primerContacto = record.contactos?.[0]
  const email = primerContacto?.emails?.[0] || record.email || ''
  if (!email) return null
  const nombre = primerContacto?.nombre || record.personaContacto || ''
  return { email, nombre, empresa: record.nombre || '', leadId: record.id }
}
```

- [ ] **Step 2: Build**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx vite build
```
Expected: sin errores (el archivo todavía no se importa desde ningún lado, así que el build solo valida sintaxis).

- [ ] **Step 3: Commit**

```bash
git add src/utils/mailingAudience.js
git commit -m "feat(mailing): utilidades puras para filtrar audiencia de envio masivo"
git push origin main
```

---

### Task 7: `BulkSendPanel`, sección "Envío masivo" y "Usar plantilla" en el compositor individual

**Files:**
- Modify: `src/services/mailing.js`
- Create: `src/components/mailing/BulkSendPanel.jsx`
- Modify: `src/pages/crm/Mailing.jsx`
- Modify: `src/components/mailing/ComposeEmailModal.jsx`

**Interfaces:**
- Consumes: `filterAudience`, `resolveRecipient`, `AUDIENCE_TYPES`, `CLIENTE_SEGMENTOS` (Task 6); `subscribeMailTemplates` (Task 5); `useMailEditor`, `EmailEditorToolbar`, `EditorContent` (Task 2); Cloud Function `sendBulkMail` (Task 4).
- Produces: `sendBulkEmail({ fromAccountId, subject, htmlBody, recipients, attachments, templateId, audienceType })` en `src/services/mailing.js`.

- [ ] **Step 1: Agregar `sendBulkEmail` a `src/services/mailing.js`**

Junto a `sendEmail`, agregar:
```js
export const sendBulkEmail = async ({ fromAccountId, subject, htmlBody, recipients, attachments, templateId, audienceType }) => {
  const fn = httpsCallable(functions, 'sendBulkMail')
  const res = await fn({ fromAccountId, subject, htmlBody, recipients, attachments, templateId, audienceType })
  return res.data
}
```

- [ ] **Step 2: Crear `BulkSendPanel.jsx`**

```jsx
import { useState, useEffect, useMemo } from 'react'
import { X, Send, Loader2, Users, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import { subscribeConnectedAccounts, subscribeMailTemplates, sendBulkEmail } from '../../services/mailing'
import { TIPOS_CLIENTE, PRODUCTOS, RESPONSABLES } from '../../utils/crmConstants'
import { AUDIENCE_TYPES, CLIENTE_SEGMENTOS, filterAudience, resolveRecipient } from '../../utils/mailingAudience'
import { useMailEditor, EmailEditorToolbar, EditorContent } from './EmailBodyEditor'

const MAX_RECIPIENTS = 500

export default function BulkSendPanel({ onClose }) {
  const { userProfile } = useAuth()
  const companyId = userProfile?.companyId

  const [leads, setLeads] = useState([])
  const [accounts, setAccounts] = useState([])
  const [templates, setTemplates] = useState([])
  const [fromAccountId, setFromAccountId] = useState('')
  const [audienceType, setAudienceType] = useState('clientes')
  const [tipo, setTipo] = useState('')
  const [producto, setProducto] = useState('')
  const [responsable, setResponsable] = useState('')
  const [segmentos, setSegmentos] = useState(['nuevos', 'antiguos'])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)

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

  const audience = useMemo(() => {
    const matched = filterAudience(leads, { audienceType, tipo, producto, responsable, segmentos })
    const recipients = []
    let sinEmail = 0
    matched.forEach((r) => {
      const recipient = resolveRecipient(r)
      if (recipient) recipients.push(recipient)
      else sinEmail += 1
    })
    return { recipients, sinEmail, total: matched.length }
  }, [leads, audienceType, tipo, producto, responsable, segmentos])

  const toggleSegmento = (key) => {
    setSegmentos((prev) => prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key])
  }

  const handlePickTemplate = (id) => {
    setTemplateId(id)
    const t = templates.find((tpl) => tpl.id === id)
    if (!t) return
    setSubject(t.subject)
    const html = t.mode === 'html' ? t.htmlSource : t.richBodyHtml
    editor?.commands.setContent(html || '')
  }

  const overLimit = audience.recipients.length > MAX_RECIPIENTS

  const handleSend = async () => {
    if (!fromAccountId) { toast.error('Elegí desde qué cuenta enviar'); return }
    if (!subject.trim()) { toast.error('Falta el asunto'); return }
    if (audience.recipients.length === 0) { toast.error('No hay destinatarios con ese filtro'); return }
    if (overLimit) { toast.error(`Hay ${audience.recipients.length} destinatarios, el máximo es ${MAX_RECIPIENTS}. Acotá el filtro.`); return }

    if (!window.confirm(`¿Enviar este email a ${audience.recipients.length} destinatarios?`)) return

    setSending(true)
    try {
      const htmlBody = editor?.getHTML() || ''
      await sendBulkEmail({
        fromAccountId,
        subject: subject.trim(),
        htmlBody,
        recipients: audience.recipients,
        templateId: templateId || null,
        audienceType,
      })
      toast.success(`Envío masivo lanzado a ${audience.recipients.length} destinatarios`)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al lanzar el envío masivo')
    } finally {
      setSending(false)
    }
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
            <div className="border border-brand-border rounded-lg overflow-hidden">
              <EmailEditorToolbar editor={editor} onPickImage={handlePickImage} mergeFields />
              <div className="mail-editor-content px-3 py-2.5 max-h-64 overflow-y-auto" onClick={() => editor?.chain().focus().run()}>
                <EditorContent editor={editor} />
              </div>
            </div>
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
```

- [ ] **Step 3: Agregar la sección "Envío masivo" a `Mailing.jsx`**

Agregar el import:
```jsx
import BulkSendPanel from '../../components/mailing/BulkSendPanel'
import { Megaphone } from 'lucide-react'
```

Agregar el estado, junto a `showCompose`:
```jsx
  const [showBulkSend, setShowBulkSend] = useState(false)
```

En el header (donde está el botón "Nuevo email"), agregar al lado un segundo botón:
```jsx
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkSend(true)}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Conectá una cuenta de Gmail primero' : ''}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Megaphone size={14} /> Envío masivo
          </button>
          <button
            onClick={() => setShowCompose(true)}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Conectá una cuenta de Gmail primero' : ''}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <PenSquare size={14} /> Nuevo email
          </button>
        </div>
```
(Esto reemplaza el único `<button>` de "Nuevo email" que hoy está directo dentro del header — envolver ambos botones en el `div` de arriba.)

Y antes del cierre del componente, junto a `{showCompose && ...}`:
```jsx
      {showBulkSend && <BulkSendPanel onClose={() => setShowBulkSend(false)} />}
```

- [ ] **Step 4: Agregar selector "Usar plantilla" a `ComposeEmailModal.jsx`**

Agregar el import:
```jsx
import { subscribeMailTemplates } from '../../services/mailing'
```

Dentro del componente, agregar estado y suscripción:
```jsx
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailTemplates(companyId, setTemplates)
    return unsub
  }, [companyId])

  const handlePickTemplate = (id) => {
    const t = templates.find((tpl) => tpl.id === id)
    if (!t) return
    setSubject(t.subject)
    const html = t.mode === 'html' ? t.htmlSource : t.richBodyHtml
    editor?.commands.setContent(html || '')
  }
```

En el JSX, entre el bloque "Para" y el bloque "Asunto", agregar (solo si hay plantillas):
```jsx
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
```

- [ ] **Step 5: Build**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx vite build
```
Expected: sin errores.

- [ ] **Step 6: Prueba manual end-to-end (con destinatarios reales de prueba)**

Antes de probar con datos reales, crear 2-3 Contactos de prueba con email propio (o de alguien del equipo) para no mandarle un envío masivo a clientes reales por error. Luego:
1. Abrir "Envío masivo", elegir "Contactos", aplicar un filtro que traiga solo esos 2-3 de prueba, confirmar que el contador coincide.
2. Elegir una plantilla, confirmar que el asunto/cuerpo se cargan.
3. Enviar. Confirmar en Firestore que se creó 1 `mailCampaign` con `recipientCount` correcto y `sentCount` incrementándose, y que cada destinatario recibió el email personalizado con su nombre/empresa reemplazados (revisar la bandeja de entrada de prueba).

- [ ] **Step 7: Commit**

```bash
git add src/services/mailing.js src/components/mailing/BulkSendPanel.jsx src/pages/crm/Mailing.jsx src/components/mailing/ComposeEmailModal.jsx
git commit -m "feat(mailing): envio masivo con filtros de audiencia y plantillas"
git push origin main
```

---

### Task 8: Historial de campañas y panel de detalle

**Files:**
- Modify: `src/services/mailing.js`
- Create: `src/components/mailing/CampaignDetail.jsx`
- Modify: `src/pages/crm/Mailing.jsx`

**Interfaces:**
- Produces: `subscribeMailCampaigns(companyId, cb)`, `subscribeCampaignLogs(campaignId, cb)` en `src/services/mailing.js`.

- [ ] **Step 1: Agregar las queries de campañas a `src/services/mailing.js`**

Agregar la constante junto a las demás:
```js
const MAIL_CAMPAIGNS_COL = 'mailCampaigns'
```

Y al final del archivo:
```js
export const subscribeMailCampaigns = (companyId, callback) => {
  const q = query(collection(db, MAIL_CAMPAIGNS_COL), where('companyId', '==', companyId))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('subscribeMailCampaigns error:', err)
  )
}

export const subscribeCampaignLogs = (campaignId, callback) => {
  const q = query(collection(db, MAILING_LOGS_COL), where('campaignId', '==', campaignId))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('subscribeCampaignLogs error:', err)
  )
}
```

- [ ] **Step 2: Crear `CampaignDetail.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { subscribeCampaignLogs } from '../../services/mailing'

function LogGroup({ title, logs, color }) {
  const [open, setOpen] = useState(false)
  if (logs.length === 0) return null
  return (
    <div className="border-b border-brand-border last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-brand-bg-2">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-sm font-medium" style={{ color }}>{title}</span>
        <span className="text-xs text-brand-text-muted">/ {logs.length}</span>
      </button>
      {open && (
        <ul className="pb-2">
          {logs.map((log) => (
            <li key={log.id} className="px-10 py-1 text-xs text-brand-text-muted truncate">{log.to}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CampaignDetail({ campaign, onClose }) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const unsub = subscribeCampaignLogs(campaign.id, setLogs)
    return unsub
  }, [campaign.id])

  const sent = logs.filter((l) => l.status === 'sent')
  const failed = logs.filter((l) => l.status === 'error')
  const date = campaign.createdAt?.toDate ? campaign.createdAt.toDate() : null

  const pct = (n) => campaign.recipientCount ? Math.round((n / campaign.recipientCount) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text truncate pr-4">{campaign.subject}</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-brand-border">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Destinatarios</p>
            <p className="text-lg font-bold text-brand-text">{campaign.recipientCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Entregado</p>
            <p className="text-lg font-bold text-green-600">{pct(campaign.sentCount)}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Falló</p>
            <p className="text-lg font-bold text-red-600">{pct(campaign.failedCount)}%</p>
          </div>
        </div>

        <div className="px-6 py-3 text-xs text-brand-text-muted border-b border-brand-border space-y-1">
          <p>Enviado por <span className="font-medium text-brand-text">{campaign.sentByName}</span> desde {campaign.fromEmail}</p>
          {date && <p>{format(date, "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>}
        </div>

        <div className="overflow-y-auto flex-1">
          <LogGroup title="Se envió con éxito" logs={sent} color="#16A34A" />
          <LogGroup title="No se pudo enviar" logs={failed} color="#DC2626" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Reemplazar el historial plano por campañas agrupadas en `Mailing.jsx`**

Agregar el import:
```jsx
import { subscribeMailCampaigns } from '../../services/mailing'
import CampaignDetail from '../../components/mailing/CampaignDetail'
```

Agregar estado, junto a `logs`:
```jsx
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)
```

Agregar el efecto de suscripción, junto al de `subscribeMailingLogs` (que ya no hace falta para el historial, pero se puede dejar si algo más lo usa — en este caso, eliminarlo si `logs`/`sortedLogs`/`LogRow` quedan sin otro uso):
```jsx
  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailCampaigns(companyId, setCampaigns)
    return unsub
  }, [companyId])
```

Eliminar `const [logs, setLogs] = useState([])`, su `useEffect` de `subscribeMailingLogs`, `sortedLogs`, la función `LogRow`, y el import de `subscribeMailingLogs` (ya no se usa desde `Mailing.jsx`; sigue existiendo en `services/mailing.js` para `CampaignDetail`/`subscribeCampaignLogs` internamente si aplica, pero no hace falta tocarlo).

Agregar:
```jsx
  const sortedCampaigns = [...campaigns].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
```

Reemplazar toda la sección "Historial de envíos" (el `<div>` que contiene el `<h2>Historial de envíos</h2>` y la tabla con `LogRow`) por:

```jsx
        <div>
          <h2 className="text-sm font-semibold text-brand-text mb-3">Historial de envíos</h2>
          {sortedCampaigns.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no se envió ningún email.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-bg">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Fecha</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Asunto</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Destinatarios</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Entregado</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Falló</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.map((c) => {
                    const date = c.createdAt?.toDate ? c.createdAt.toDate() : null
                    const pct = (n) => c.recipientCount ? Math.round((n / c.recipientCount) * 100) : 0
                    return (
                      <tr key={c.id} onClick={() => setSelectedCampaign(c)} className="border-b border-brand-border last:border-0 hover:bg-brand-bg-2 cursor-pointer">
                        <td className="px-3 py-2 text-xs text-brand-text-muted whitespace-nowrap">
                          {date ? format(date, "d MMM yyyy, HH:mm", { locale: es }) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-brand-text truncate max-w-[220px]">{c.subject}</td>
                        <td className="px-3 py-2 text-xs text-brand-text-muted">{c.recipientCount}</td>
                        <td className="px-3 py-2 text-xs text-green-700 font-medium">{pct(c.sentCount)}%</td>
                        <td className="px-3 py-2 text-xs text-red-600 font-medium">{pct(c.failedCount)}%</td>
                        <td className="px-3 py-2 text-xs">
                          {c.status === 'done' ? (
                            <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> Enviado</span>
                          ) : (
                            <span className="badge bg-amber-100 text-amber-700">Enviando...</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
```

(Nota: `CheckCircle2` y `XCircle` ya están importados de `lucide-react` en este archivo; si `XCircle` deja de usarse tras este cambio, quitarlo del import para que no quede un import sin uso.)

Y antes del cierre del componente:
```jsx
      {selectedCampaign && <CampaignDetail campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}
```

- [ ] **Step 4: Build**

```bash
cd "C:\Users\Imalo\Desktop\AGENTES\AGENTES TRABAJO\TAREAS Y CRM POLLO - PASTAS"
npx vite build
```
Expected: sin errores, sin warnings de imports no usados.

- [ ] **Step 5: Prueba manual**

Recargar `/crm/mailing`. Confirmar que el historial muestra una fila por campaña (incluyendo los envíos individuales de prueba de tasks anteriores, con `recipientCount: 1`) con los porcentajes correctos. Click en una fila del envío masivo de prueba del Task 7 y confirmar que el panel de detalle muestra la lista real de emails en "Se envió con éxito"/"No se pudo enviar".

- [ ] **Step 6: Commit**

```bash
git add src/services/mailing.js src/components/mailing/CampaignDetail.jsx src/pages/crm/Mailing.jsx
git commit -m "feat(mailing): historial de campanas unificado con panel de detalle"
git push origin main
```

---

## Self-Review (completado por quien escribió el plan)

- **Cobertura de la spec:** Plantillas (Task 5) ✓, envío masivo con filtros de Leads/Contactos/Clientes (Task 6-7) ✓, un email por destinatario con reemplazo de `{{nombre}}`/`{{empresa}}` (Task 4) ✓, tope de 500 con corte cliente+servidor (Task 4, 7) ✓, historial unificado individual+masivo (Task 3, 8) ✓, editor compartido (Task 2) ✓, reglas de Firestore (Task 1) ✓. Tracking de apertura/clic/baja de suscripción y envíos programados: fuera de alcance, no tienen task (correcto, están diferidos en la spec).
- **Placeholders:** ninguno — todos los steps de código tienen el código completo.
- **Consistencia de tipos:** `resolveRecipient` devuelve `{ email, nombre, empresa, leadId }`, consumido igual en `BulkSendPanel` (Task 7) y usado por `applyMergeFields` en el backend (Task 4) con las mismas claves `nombre`/`empresa`. `mailCampaigns` usa los mismos nombres de campo (`recipientCount`, `sentCount`, `failedCount`, `status`, `audienceType`) en Task 3 (creación), Task 4 (incremento), y Task 8 (lectura/display) — verificado consistente.
