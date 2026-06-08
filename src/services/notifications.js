import { db } from '../firebase'
import {
  collection, addDoc, updateDoc, query, where,
  onSnapshot, serverTimestamp, writeBatch, getDocs, doc,
} from 'firebase/firestore'
import { NOTIFICATION_TYPES } from '../utils/constants'

const COL = 'notifications'

export const createNotification = async ({ recipientId, taskId, taskTitle, type, senderName }) => {
  await addDoc(collection(db, COL), {
    recipientId,
    taskId,
    taskTitle,
    type,
    message: NOTIFICATION_TYPES[type] || type,
    senderName: senderName || 'Sistema',
    read: false,
    createdAt: serverTimestamp(),
  })
}

// Sin orderBy → evita índice compuesto, ordenamos client-side
export const subscribeNotifications = (userId, callback) => {
  const q = query(collection(db, COL), where('recipientId', '==', userId))
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    callback(notifs)
  }, (err) => console.error('subscribeNotifications error:', err))
}

export const markAsRead = async (notificationId) => {
  await updateDoc(doc(db, COL, notificationId), { read: true })
}

export const markAllAsRead = async (userId) => {
  const q = query(collection(db, COL), where('recipientId', '==', userId), where('read', '==', false))
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

export const requestPushPermission = async (uid) => {
  if (!('Notification' in window)) return false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  try {
    const { getMessagingInstance } = await import('../firebase')
    const { getToken } = await import('firebase/messaging')
    const messaging = await getMessagingInstance()
    if (!messaging) return false
    const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY })
    if (token) {
      const { updateFCMToken } = await import('./users')
      await updateFCMToken(uid, token)
    }
    return true
  } catch {
    return false
  }
}

export const showBrowserNotification = (title, body, taskId) => {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/task-tracker/favicon.svg',
    tag: taskId,
  })
  n.onclick = () => {
    window.focus()
    window.location.hash = `/tasks/${taskId}`
  }
}
