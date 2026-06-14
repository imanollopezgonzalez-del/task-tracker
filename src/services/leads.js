import { db } from '../firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  query, where, onSnapshot, serverTimestamp, orderBy,
} from 'firebase/firestore'

const LEADS_COL = 'leads'
const NOTAS_SUB = 'notas'

export const createLead = async (data, userId) => {
  const ref = await addDoc(collection(db, LEADS_COL), {
    ...data,
    contactado: false,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export const updateLead = async (leadId, data) => {
  await updateDoc(doc(db, LEADS_COL, leadId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export const deleteLead = async (leadId) => {
  await deleteDoc(doc(db, LEADS_COL, leadId))
}

export const getLead = async (leadId) => {
  const snap = await getDoc(doc(db, LEADS_COL, leadId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const subscribeLeads = (companyId, callback) => {
  const q = query(collection(db, LEADS_COL), where('companyId', '==', companyId))
  return onSnapshot(q, (snap) => {
    const leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(leads)
  }, (err) => console.error('subscribeLeads error:', err))
}

export const addNota = async (leadId, texto, tipo, user) => {
  await addDoc(collection(db, LEADS_COL, leadId, NOTAS_SUB), {
    texto,
    tipo: tipo || 'nota',
    autorId: user.uid,
    autorNombre: user.displayName || user.email,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, LEADS_COL, leadId), { updatedAt: serverTimestamp() })
}

export const deleteNota = async (leadId, notaId) => {
  await deleteDoc(doc(db, LEADS_COL, leadId, NOTAS_SUB, notaId))
}

export const subscribeNotas = (leadId, callback) => {
  const q = query(collection(db, LEADS_COL, leadId, NOTAS_SUB), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeNotas error:', err))
}
