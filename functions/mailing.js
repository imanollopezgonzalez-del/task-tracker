const { onCall, HttpsError } = require('firebase-functions/v2/https')
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

  const campaignId = await createMailCampaign(db, {
    companyId: caller.companyId, subject, fromAccountId, fromEmail,
    sentBy: caller.uid, sentByName: caller.displayName,
    templateId, audienceType, recipientCount: recipients.length,
  })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  for (const recipient of recipients) {
    const personalizedSubject = applyMergeFields(subject, recipient)
    const personalizedBody = applyMergeFields(htmlBody, recipient)
    // No guardamos htmlBody acá (a diferencia de sendMail): con plantillas HTML reales de
    // 50-100KB+ y hasta 500 destinatarios, escribir el cuerpo completo en cada log individual
    // puede acercarse o superar el límite de 1 MiB por documento de Firestore y arriesga
    // hacer fallar la campaña entera escritura por escritura. El subject es chico, se guarda igual.
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
          html: personalizedBody,
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
      await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'sent', gmailMessageId })
      await bumpCampaignCounter(db, campaignId, 'sentCount')
    } else {
      console.error('sendBulkMail: fallo el envío a', recipient.email, sendErr.message)
      await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage: sendErr.message || 'send_failed' })
      await bumpCampaignCounter(db, campaignId, 'failedCount')
    }
  }

  await finishCampaign(db, campaignId)

  return { ok: true, campaignId }
})

module.exports = { connectGmailAccount, disconnectGmailAccount, sendMail, sendBulkMail }
