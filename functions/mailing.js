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

  const logBase = {
    companyId: caller.companyId,
    fromAccountId,
    fromEmail,
    to,
    subject,
    htmlBody,
    hasAttachments: Array.isArray(attachments) && attachments.length > 0,
    leadId: leadId || null,
    sentBy: caller.uid,
    sentByName: caller.displayName,
    createdAt: FieldValue.serverTimestamp(),
  }

  try {
    await oauth2Client.refreshAccessToken()
  } catch (err) {
    console.error('sendMail: refreshAccessToken failed', err.message)
    await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage: 'reauth_required' })
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
      throw new HttpsError('invalid-argument', `Adjunto inválido: "${att.filename}"`)
    }
    try {
      const [buffer] = await bucket.file(att.path).download()
      mailAttachments.push({ filename: att.filename, content: buffer, contentType: att.mimeType })
    } catch (err) {
      console.error('sendMail: no se pudo leer adjunto', att.filename, err.message)
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
    await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage: 'mime_build_failed' })
    throw new HttpsError('internal', 'No se pudo armar el email')
  }

  let gmailMessageId
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
    const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    gmailMessageId = res.data.id
  } catch (err) {
    console.error('sendMail: gmail send failed', err)
    await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'error', errorMessage: 'gmail_send_failed' })
    throw new HttpsError('internal', 'Gmail rechazó el envío del email')
  }

  const logRef = await db.collection(MAILING_LOGS_COL).add({ ...logBase, status: 'sent', gmailMessageId })

  return { ok: true, logId: logRef.id, gmailMessageId }
})

module.exports = { connectGmailAccount, disconnectGmailAccount, sendMail }
