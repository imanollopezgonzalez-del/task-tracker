import { db } from '../firebase'
import {
  doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, serverTimestamp,
} from 'firebase/firestore'

export const createUserProfile = async (user, extra = {}) => {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: extra.displayName || user.displayName || user.email.split('@')[0],
      role: extra.role || 'employee',
      companyId: extra.companyId || null,
      fcmToken: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  return (await getDoc(ref)).data()
}

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null
}

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() })
}

export const updateFCMToken = async (uid, token) => {
  await updateDoc(doc(db, 'users', uid), { fcmToken: token, updatedAt: serverTimestamp() })
}

export const getCompanyUsers = async (companyId) => {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

export const subscribeCompanyUsers = (companyId, callback) => {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
  })
}

export const createCompany = async (name, ownerUid) => {
  const ref = doc(collection(db, 'companies'))
  await setDoc(ref, { name, ownerUid, createdAt: serverTimestamp() })
  await updateDoc(doc(db, 'users', ownerUid), { companyId: ref.id, role: 'admin', updatedAt: serverTimestamp() })
  return ref.id
}

export const joinCompany = async (uid, companyId) => {
  const snap = await getDoc(doc(db, 'companies', companyId))
  if (!snap.exists()) throw new Error('Empresa no encontrada')
  await updateDoc(doc(db, 'users', uid), { companyId, role: 'employee', updatedAt: serverTimestamp() })
}

export const getCompany = async (companyId) => {
  if (!companyId) return null
  const snap = await getDoc(doc(db, 'companies', companyId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
