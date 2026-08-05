import { db, functions, storage } from '../firebase'
import { doc, onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const MAILING_SETTINGS_COL = 'mailingSettings'
const MAILING_LOGS_COL = 'mailingLogs'
const MAIL_TEMPLATES_COL = 'mailTemplates'

export const subscribeConnectedAccounts = (companyId, callback) => {
  const settingsRef = doc(db, MAILING_SETTINGS_COL, companyId)
  return onSnapshot(
    settingsRef,
    (snap) => callback(snap.exists() ? snap.data().connectedAccounts || [] : []),
    (err) => console.error('subscribeConnectedAccounts error:', err)
  )
}

export const connectGmailAccount = async (authCode) => {
  const fn = httpsCallable(functions, 'connectGmailAccount')
  const res = await fn({ authCode })
  return res.data
}

export const disconnectGmailAccount = async (accountId) => {
  const fn = httpsCallable(functions, 'disconnectGmailAccount')
  await fn({ accountId })
}

export const sendEmail = async ({ fromAccountId, to, subject, htmlBody, attachments, leadId }) => {
  const fn = httpsCallable(functions, 'sendMail')
  const res = await fn({ fromAccountId, to, subject, htmlBody, attachments, leadId })
  return res.data
}

export const subscribeMailingLogs = (companyId, callback) => {
  const q = query(collection(db, MAILING_LOGS_COL), where('companyId', '==', companyId))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('subscribeMailingLogs error:', err)
  )
}

export const uploadMailingImage = async (companyId, file) => {
  const ext = file.name.split('.').pop() || 'png'
  const path = `mailing/${companyId}/${crypto.randomUUID()}.${ext}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export const uploadMailingAttachment = async (companyId, file) => {
  const path = `mailing/${companyId}/attachments/${crypto.randomUUID()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  // El backend usa "path" (no "url") para leer el archivo directo de Storage con el
  // Admin SDK y evitar que sendMail haga fetch() a una URL arbitraria (SSRF).
  return { filename: file.name, url, path, mimeType: file.type }
}

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
