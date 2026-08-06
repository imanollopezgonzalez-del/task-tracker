const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { google } = require('googleapis')
const MailComposer = require('nodemailer/lib/mail-composer')

const { requireCrmUser } = require('./lib/authz')
const { createOAuth2Client } = require('./lib/googleAuth')

const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET')

const MAILING_TOKENS_COL = 'mailingTokens'
const MAILING_SETTINGS_COL = 'mailingSettings'
const MAILING_LOGS_COL = 'mailingLogs'
const MAILING_CAMPAIGNS_COL = 'mailCampaigns'
const MAILING_UNSUBSCRIBES_COL = 'mailingUnsubscribes'

// Región fija de despliegue de las Cloud Functions de mailing (ver functions/index.js) —
// necesaria para armar URLs públicas absolutas de tracking que van DENTRO del HTML del email.
const FUNCTIONS_REGION = 'us-central1'
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gestion-tareas-pariggi'
const FUNCTIONS_BASE_URL = `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net`

// ---------------------------------------------------------------------------
// Fase 2: tracking de apertura/clicks + baja de suscripción
// ---------------------------------------------------------------------------

const toBase64Url = (str) => Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

// Reescribe el HTML del email antes de mandarlo: cada <a href> pasa por un redirect que
// registra el click, se agrega un pixel de 1x1 para registrar apertura, y un link de baja
// de suscripción al pie. logId es el id (todavía no escrito) del futuro doc en mailingLogs —
// se genera antes con db.collection(...).doc() para poder embeberlo acá.
function injectTracking(html, logId) {
  if (!logId) return html
  const trackOpenUrl = `${FUNCTIONS_BASE_URL}/trackOpen?l=${logId}`
  const unsubscribeUrl = `${FUNCTIONS_BASE_URL}/unsubscribe?l=${logId}`

  const rewritten = (html || '').replace(/(<a\s+[^>]*?href=)(["'])(.*?)\2/gi, (match, prefix, quote, url) => {
    const trimmed = url.trim()
    if (!trimmed || /^(mailto:|tel:|#)/i.test(trimmed)) return match
    const trackUrl = `${FUNCTIONS_BASE_URL}/trackClick?l=${logId}&u=${toBase64Url(trimmed)}`
    return `${prefix}${quote}${trackUrl}${quote}`
  })

  const pixel = `<img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="" />`
  const footer = `<p style="font-size:11px;color:#999;margin-top:24px;">` +
    `¿No querés recibir más estos emails? <a href="${unsubscribeUrl}" style="color:#999;">Darte de baja</a></p>`

  return `${rewritten}${footer}${pixel}`
}

async function registerOpen(db, logId) {
  const logRef = db.doc(`${MAILING_LOGS_COL}/${logId}`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(logRef)
    if (!snap.exists) return
    const data = snap.data()
    const isFirstOpen = !data.firstOpenedAt
    tx.update(logRef, {
      openCount: FieldValue.increment(1),
      lastOpenedAt: FieldValue.serverTimestamp(),
      ...(isFirstOpen ? { firstOpenedAt: FieldValue.serverTimestamp() } : {}),
    })
    if (isFirstOpen && data.campaignId) {
      tx.update(db.doc(`${MAILING_CAMPAIGNS_COL}/${data.campaignId}`), { openedCount: FieldValue.increment(1) })
    }
  })
}

async function registerClick(db, logId) {
  const logRef = db.doc(`${MAILING_LOGS_COL}/${logId}`)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(logRef)
    if (!snap.exists) return
    const data = snap.data()
    const isFirstClick = !data.firstClickedAt
    tx.update(logRef, {
      clickCount: FieldValue.increment(1),
      lastClickedAt: FieldValue.serverTimestamp(),
      ...(isFirstClick ? { firstClickedAt: FieldValue.serverTimestamp() } : {}),
    })
    if (isFirstClick && data.campaignId) {
      tx.update(db.doc(`${MAILING_CAMPAIGNS_COL}/${data.campaignId}`), { clickedCount: FieldValue.increment(1) })
    }
  })
}

const TRANSPARENT_GIF_PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

// Endpoint público (no-callable, sin auth): lo carga el cliente de correo del destinatario
// como una <img>. Nunca debe devolver un error visible — si el logId no existe simplemente
// no registra nada y sirve el pixel igual, para no romper el render del email.
const trackOpen = onRequest(async (req, res) => {
  res.set('Content-Type', 'image/gif')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  const logId = typeof req.query.l === 'string' ? req.query.l : null
  if (logId) {
    try { await registerOpen(getFirestore(), logId) } catch (err) { console.error('trackOpen error', err) }
  }
  res.status(200).send(TRANSPARENT_GIF_PIXEL)
})

// Endpoint público: redirige al link real, registrando el click antes. Solo redirige a
// http(s) (nunca javascript:/data:/etc) para no habilitar esquemas peligrosos vía este proxy.
const trackClick = onRequest(async (req, res) => {
  const logId = typeof req.query.l === 'string' ? req.query.l : null
  const encoded = typeof req.query.u === 'string' ? req.query.u : null
  let targetUrl = null
  if (encoded) {
    try { targetUrl = fromBase64Url(encoded) } catch { targetUrl = null }
  }
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.status(400).send('Link inválido')
    return
  }
  if (logId) {
    try { await registerClick(getFirestore(), logId) } catch (err) { console.error('trackClick error', err) }
  }
  res.redirect(302, targetUrl)
})

const escapeHtml = (str) => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function unsubscribePage(message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Baja de suscripción</title>` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;` +
    `text-align:center;color:#1a1a1a;padding:0 20px;line-height:1.5}</style>` +
    `</head><body><h2>${message}</h2></body></html>`
}

// Endpoint público: marca el email del destinatario como dado de baja de envíos masivos
// para esa empresa (mailingUnsubscribes/{companyId}_{email}). No requiere auth — es el
// link que el propio destinatario clickea desde su email.
const unsubscribe = onRequest(async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8')
  const logId = typeof req.query.l === 'string' ? req.query.l : null
  if (!logId) {
    res.status(400).send(unsubscribePage('Link inválido.'))
    return
  }
  try {
    const db = getFirestore()
    const logSnap = await db.doc(`${MAILING_LOGS_COL}/${logId}`).get()
    if (!logSnap.exists) {
      res.status(200).send(unsubscribePage('Este link ya no es válido.'))
      return
    }
    const { companyId, to } = logSnap.data()
    const email = (to || '').toLowerCase()
    await db.doc(`${MAILING_UNSUBSCRIBES_COL}/${companyId}_${email}`).set({
      companyId, email, unsubscribedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    res.status(200).send(unsubscribePage(`Listo — <strong>${escapeHtml(email)}</strong> no va a recibir más envíos masivos de esta empresa.`))
  } catch (err) {
    console.error('unsubscribe error', err)
    res.status(500).send(unsubscribePage('Hubo un error. Intentá de nuevo más tarde.'))
  }
})

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
  // updatedAt funciona como heartbeat: si la instancia de la función muere a mitad del loop
  // (p. ej. hard timeout de 540s en una campaña muy grande), el cliente puede detectar que
  // la campaña quedó "trabada" comparando este timestamp contra el momento actual.
  await db.doc(`${MAILING_CAMPAIGNS_COL}/${campaignId}`).update({
    [field]: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

async function finishCampaign(db, campaignId) {
  await db.doc(`${MAILING_CAMPAIGNS_COL}/${campaignId}`).update({ status: 'done' })
}

// ---------------------------------------------------------------------------
// connectGmailAccount
// ---------------------------------------------------------------------------
const connectGmailAccount = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET] }, async (request) => {
  const caller = await requireCrmUser(request.auth?.uid)
  const { authCode } = request.data || {}
  if (!authCode) throw new HttpsError('invalid-argument', 'Falta el código de autorización')

  const db = getFirestore()
  const oauth2Client = createOAuth2Client(GOOGLE_OAUTH_CLIENT_SECRET.value())

  let tokens
  try {
    const result = await oauth2Client.getToken(authCode)
    tokens = result.tokens
  } catch (err) {
    console.error('connectGmailAccount: getToken failed', err)
    throw new HttpsError('internal', 'No se pudo validar la autorización de Google')
  }

  if (!tokens.refresh_token) {
    throw new HttpsError(
      'failed-precondition',
      'Google no devolvió un token de acceso permanente. Revocá el acceso en https://myaccount.google.com/permissions y volvé a intentar conectar la cuenta.'
    )
  }

  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  let email
  try {
    const { data } = await oauth2.userinfo.get()
    email = data.email
  } catch (err) {
    console.error('connectGmailAccount: userinfo failed', err)
    throw new HttpsError('internal', 'No se pudo obtener el email de la cuenta de Google')
  }
  if (!email) throw new HttpsError('internal', 'No se pudo obtener el email de la cuenta de Google')

  // Si ya existe una cuenta conectada con este email para la empresa, actualizamos el token (reconexión)
  const existingSnap = await db
    .collection(MAILING_TOKENS_COL)
    .where('companyId', '==', caller.companyId)
    .where('email', '==', email)
    .limit(1)
    .get()

  let accountId
  if (!existingSnap.empty) {
    accountId = existingSnap.docs[0].id
    await db.doc(`${MAILING_TOKENS_COL}/${accountId}`).update({
      refreshToken: tokens.refresh_token,
      reconnectedAt: FieldValue.serverTimestamp(),
    })
  } else {
    const docRef = await db.collection(MAILING_TOKENS_COL).add({
      companyId: caller.companyId,
      email,
      refreshToken: tokens.refresh_token,
      connectedBy: caller.uid,
      connectedAt: FieldValue.serverTimestamp(),
    })
    accountId = docRef.id
  }

  const account = { id: accountId, email, label: email, connectedBy: caller.displayName, status: 'connected' }

  const settingsRef = db.doc(`${MAILING_SETTINGS_COL}/${caller.companyId}`)
  const settingsSnap = await settingsRef.get()
  const connectedAccounts = settingsSnap.exists ? settingsSnap.data().connectedAccounts || [] : []
  const withoutThis = connectedAccounts.filter((a) => a.id !== accountId)
  await settingsRef.set({ connectedAccounts: [...withoutThis, account] }, { merge: true })

  return account
})

// ---------------------------------------------------------------------------
// disconnectGmailAccount
// ---------------------------------------------------------------------------
const disconnectGmailAccount = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET] }, async (request) => {
  const caller = await requireCrmUser(request.auth?.uid)
  const { accountId } = request.data || {}
  if (!accountId) throw new HttpsError('invalid-argument', 'Falta el id de la cuenta')

  const db = getFirestore()
  const tokenRef = db.doc(`${MAILING_TOKENS_COL}/${accountId}`)
  const tokenSnap = await tokenRef.get()
  if (!tokenSnap.exists || tokenSnap.data().companyId !== caller.companyId) {
    throw new HttpsError('permission-denied', 'Cuenta no encontrada')
  }

  const { refreshToken } = tokenSnap.data()
  try {
    const oauth2Client = createOAuth2Client(GOOGLE_OAUTH_CLIENT_SECRET.value())
    await oauth2Client.revokeToken(refreshToken)
  } catch (err) {
    console.warn('disconnectGmailAccount: revoke falló (se ignora)', err.message)
  }

  await tokenRef.delete()

  const settingsRef = db.doc(`${MAILING_SETTINGS_COL}/${caller.companyId}`)
  const settingsSnap = await settingsRef.get()
  if (settingsSnap.exists) {
    const connectedAccounts = (settingsSnap.data().connectedAccounts || []).filter((a) => a.id !== accountId)
    await settingsRef.set({ connectedAccounts }, { merge: true })
  }

  return { ok: true }
})

// ---------------------------------------------------------------------------
// sendMail
// ---------------------------------------------------------------------------
const sendMail = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET], timeoutSeconds: 60, memory: '512MiB' }, async (request) => {
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

  // Se genera el id del log ANTES de mandar el mail (sin escribir nada todavía) para poder
  // embeber ese id en el pixel de apertura, el link de baja y los links reescritos del propio
  // cuerpo del email — ver injectTracking.
  const logRef = db.collection(MAILING_LOGS_COL).doc()

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
    await logRef.set({ ...logBase, status: 'error', errorMessage })
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
      html: injectTracking(htmlBody, logRef.id),
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

  await logRef.set({ ...logBase, status: 'sent', gmailMessageId })
  await bumpCampaignCounter(db, campaignId, 'sentCount')
  await finishCampaign(db, campaignId)

  return { ok: true, logId: logRef.id, gmailMessageId, campaignId }
})

// ---------------------------------------------------------------------------
// sendBulkMail
// ---------------------------------------------------------------------------
function applyMergeFields(text, { nombre, empresa }) {
  return (text || '')
    .replaceAll('{{nombre}}', nombre || '')
    .replaceAll('{{empresa}}', empresa || '')
}

const MAX_BULK_RECIPIENTS = 500

const sendBulkMail = onCall({ secrets: [GOOGLE_OAUTH_CLIENT_SECRET], timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  const caller = await requireCrmUser(request.auth?.uid)
  const { fromAccountId, subject, htmlBody, recipients, attachments, templateId, audienceType } = request.data || {}

  if (!fromAccountId || !subject || !htmlBody || !Array.isArray(recipients) || recipients.length === 0) {
    throw new HttpsError('invalid-argument', 'Faltan datos del envío masivo (cuenta, asunto, cuerpo o destinatarios)')
  }
  if (typeof subject !== 'string' || typeof htmlBody !== 'string') {
    throw new HttpsError('invalid-argument', 'El asunto y el cuerpo del email deben ser texto')
  }
  if (recipients.length > MAX_BULK_RECIPIENTS) {
    throw new HttpsError('invalid-argument', `El envío masivo admite hasta ${MAX_BULK_RECIPIENTS} destinatarios (se recibieron ${recipients.length})`)
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const r of recipients) {
    if (typeof r?.email !== 'string' || !EMAIL_RE.test(r.email)) {
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

  // Defensa en profundidad: el frontend ya excluye a los dados de baja del conteo/lista
  // (ver mailingAudience.js), pero si la lista llegó stale (otra pestaña dio de baja a
  // alguien mientras se armaba este envío) igual no le mandamos nada acá.
  const unsubSnap = await db.collection(MAILING_UNSUBSCRIBES_COL).where('companyId', '==', caller.companyId).get()
  const unsubscribedEmails = new Set(unsubSnap.docs.map((d) => d.data().email))

  const campaignId = await createMailCampaign(db, {
    companyId: caller.companyId, subject, fromAccountId, fromEmail,
    sentBy: caller.uid, sentByName: caller.displayName,
    templateId, audienceType, recipientCount: recipients.length,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  for (const recipient of recipients) {
    if (unsubscribedEmails.has(recipient.email.toLowerCase())) {
      await db.collection(MAILING_LOGS_COL).add({
        companyId: caller.companyId, fromAccountId, fromEmail, to: recipient.email,
        subject: applyMergeFields(subject, recipient), hasAttachments: mailAttachments.length > 0,
        leadId: recipient.leadId || null, campaignId, sentBy: caller.uid, sentByName: caller.displayName,
        createdAt: FieldValue.serverTimestamp(), status: 'skipped', errorMessage: 'unsubscribed',
      })
      await bumpCampaignCounter(db, campaignId, 'skippedCount')
      continue
    }

    const personalizedSubject = applyMergeFields(subject, recipient)
    const personalizedBody = applyMergeFields(htmlBody, recipient)
    // No guardamos htmlBody acá (a diferencia de sendMail): con plantillas HTML reales de
    // 50-100KB+ y hasta 500 destinatarios, escribir el cuerpo completo en cada log individual
    // puede acercarse o superar el límite de 1 MiB por documento de Firestore y arriesga
    // hacer fallar la campaña entera escritura por escritura. El subject es chico, se guarda igual.
    // Igual que en sendMail, el id del log se genera antes de mandar para poder embeberlo
    // en el pixel/links/baja reescritos en el propio cuerpo del email de este destinatario.
    const logRef = db.collection(MAILING_LOGS_COL).doc()
    const logBase = {
      companyId: caller.companyId,
      fromAccountId,
      fromEmail,
      to: recipient.email,
      subject: personalizedSubject,
      hasAttachments: mailAttachments.length > 0,
      leadId: recipient.leadId || null,
      campaignId,
      sentBy: caller.uid,
      sentByName: caller.displayName,
      createdAt: FieldValue.serverTimestamp(),
    }

    let sendErr = null
    let gmailMessageId = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const mail = new MailComposer({
          from: fromEmail,
          to: recipient.email,
          subject: personalizedSubject,
          html: injectTracking(personalizedBody, logRef.id),
          attachments: mailAttachments,
        })
        const mimeMessage = await new Promise((resolve, reject) => {
          mail.compile().build((err, message) => (err ? reject(err) : resolve(message)))
        })
        const raw = mimeMessage.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

        const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
        gmailMessageId = res.data.id
        sendErr = null
        break
      } catch (err) {
        sendErr = err
        // googleapis (gaxios) expone el status HTTP como err.response.status (number) o,
        // según la versión/tipo de error, como err.code (a veces string). Normalizamos.
        const rawStatus = err.response?.status ?? err.code
        const status = typeof rawStatus === 'string' ? parseInt(rawStatus, 10) : rawStatus
        const isTransient = status === 429 || (typeof status === 'number' && !Number.isNaN(status) && status >= 500 && status < 600)
        if (isTransient && attempt === 0) {
          console.warn('sendBulkMail: error transitorio con', recipient.email, '- reintentando en 1s', status || err.message)
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        break
      }
    }

    if (!sendErr) {
      await logRef.set({ ...logBase, status: 'sent', gmailMessageId })
      await bumpCampaignCounter(db, campaignId, 'sentCount')
    } else {
      console.error('sendBulkMail: fallo el envío a', recipient.email, sendErr.message)
      await logRef.set({ ...logBase, status: 'error', errorMessage: sendErr.message || 'send_failed' })
      await bumpCampaignCounter(db, campaignId, 'failedCount')
    }
  }

  await finishCampaign(db, campaignId)

  return { ok: true, campaignId }
})

module.exports = {
  connectGmailAccount, disconnectGmailAccount, sendMail, sendBulkMail,
  trackOpen, trackClick, unsubscribe,
}
