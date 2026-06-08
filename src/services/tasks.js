import { db } from '../firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore'
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'

const TASKS_COL = 'tasks'
const COMMENTS_SUB = 'comments'

const sortByCreated = (tasks) =>
  [...tasks].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))

export const createTask = async (data, userId) => {
  const taskData = {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: data.status || 'not_started',
    completedAt: null,
  }
  if (data.dueDate) taskData.dueDate = Timestamp.fromDate(new Date(data.dueDate))
  if (data.startDate) taskData.startDate = Timestamp.fromDate(new Date(data.startDate))
  const ref = await addDoc(collection(db, TASKS_COL), taskData)
  return ref.id
}

export const updateTask = async (taskId, data) => {
  const updates = { ...data, updatedAt: serverTimestamp() }
  if (data.dueDate && !(data.dueDate?.toDate)) updates.dueDate = Timestamp.fromDate(new Date(data.dueDate))
  if (data.startDate && !(data.startDate?.toDate)) updates.startDate = Timestamp.fromDate(new Date(data.startDate))
  if (data.status === 'done' && !data.completedAt) updates.completedAt = serverTimestamp()
  if (data.status && data.status !== 'done') updates.completedAt = null
  await updateDoc(doc(db, TASKS_COL, taskId), updates)
}

export const deleteTask = async (taskId) => {
  await deleteDoc(doc(db, TASKS_COL, taskId))
}

export const getTask = async (taskId) => {
  const snap = await getDoc(doc(db, TASKS_COL, taskId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Sin orderBy en queries compuestas → evita necesidad de índices compuestos en Firestore
export const subscribeTasks = (companyId, callback) => {
  const q = query(collection(db, TASKS_COL), where('companyId', '==', companyId))
  return onSnapshot(q, (snap) => {
    callback(sortByCreated(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, (err) => console.error('subscribeTasks error:', err))
}

export const subscribeMyTasks = (userId, companyId, callback) => {
  const q = query(
    collection(db, TASKS_COL),
    where('companyId', '==', companyId),
    where('assignedTo', '==', userId)
  )
  return onSnapshot(q, (snap) => {
    callback(sortByCreated(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, (err) => console.error('subscribeMyTasks error:', err))
}

export const addComment = async (taskId, text, user) => {
  await addDoc(collection(db, TASKS_COL, taskId, COMMENTS_SUB), {
    text,
    authorId: user.uid,
    authorName: user.displayName || user.email,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, TASKS_COL, taskId), { updatedAt: serverTimestamp() })
}

export const subscribeComments = (taskId, callback) => {
  const q = query(collection(db, TASKS_COL, taskId, COMMENTS_SUB), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeComments error:', err))
}

export const completeAndRecur = async (task, userId) => {
  const batch = writeBatch(db)
  batch.update(doc(db, TASKS_COL, task.id), {
    status: 'done',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (task.type === 'recurring' && task.recurrence) {
    const base = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate)
    let nextDate
    switch (task.recurrence) {
      case 'daily': nextDate = addDays(base, 1); break
      case 'weekly': nextDate = addWeeks(base, 1); break
      case 'monthly': nextDate = addMonths(base, 1); break
      case 'annual': nextDate = addYears(base, 1); break
    }
    const newRef = doc(collection(db, TASKS_COL))
    batch.set(newRef, {
      ...task,
      id: undefined,
      status: 'not_started',
      completedAt: null,
      dueDate: Timestamp.fromDate(nextDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      parentTaskId: task.id,
    })
  }
  await batch.commit()
}
