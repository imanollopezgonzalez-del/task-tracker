import { db } from '../firebase'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore'
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'

const TASKS_COL = 'tasks'
const COMMENTS_SUB = 'comments'

// Parsea "YYYY-MM-DD" como medianoche local (evita que new Date("YYYY-MM-DD") use UTC)
const parseLocalDate = (str) => new Date(str + 'T00:00:00')

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
  if (data.dueDate) taskData.dueDate = Timestamp.fromDate(parseLocalDate(data.dueDate))
  if (data.startDate) taskData.startDate = Timestamp.fromDate(parseLocalDate(data.startDate))
  const ref = await addDoc(collection(db, TASKS_COL), taskData)
  return ref.id
}

export const updateTask = async (taskId, data) => {
  const updates = { ...data, updatedAt: serverTimestamp() }
  if (data.dueDate && !(data.dueDate?.toDate)) updates.dueDate = Timestamp.fromDate(parseLocalDate(data.dueDate))
  if (data.startDate && !(data.startDate?.toDate)) updates.startDate = Timestamp.fromDate(parseLocalDate(data.startDate))
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
  let assigned = []
  let verifier = []
  const merge = () => {
    const map = new Map()
    ;[...assigned, ...verifier].forEach((t) => map.set(t.id, t))
    callback(sortByCreated([...map.values()]))
  }
  const q1 = query(collection(db, TASKS_COL), where('companyId', '==', companyId), where('assignedTo', '==', userId))
  const q2 = query(collection(db, TASKS_COL), where('companyId', '==', companyId), where('verifiedBy', '==', userId))
  const u1 = onSnapshot(q1, (snap) => { assigned = snap.docs.map((d) => ({ id: d.id, ...d.data() })); merge() }, console.error)
  const u2 = onSnapshot(q2, (snap) => { verifier = snap.docs.map((d) => ({ id: d.id, ...d.data(), isVerifierTask: true })); merge() }, console.error)
  return () => { u1(); u2() }
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

export const createSeguimientoTask = async (companyId, cliente, assignedToUid, tipo = 'cliente_activo') => {
  const title = tipo === 'cliente_perdido'
    ? `Seguimiento Cliente Perdido "${cliente.nombre}"`
    : `Seguimiento "${cliente.nombre}"`
  const ref = await addDoc(collection(db, TASKS_COL), {
    companyId,
    title,
    description: 'Contactar al cliente para verificar su estado actual.',
    priority: 'important',
    status: 'not_started',
    type: 'single',
    assignedTo: assignedToUid,
    clienteId: cliente.id,
    seguimientoType: tipo,
    dueDate: Timestamp.fromDate(new Date()),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  })
  return ref.id
}

export const completeAndRecur = async (task, userId) => {
  const batch = writeBatch(db)
  batch.update(doc(db, TASKS_COL, task.id), {
    status: 'done',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  if (task.type === 'recurring' && task.recurrence) {
    // Base siempre es hoy para daily/weekly/monthly; annual conserva la fecha original
    const todayBase = new Date()
    const originalBase = task.dueDate?.toDate
      ? task.dueDate.toDate()
      : task.dueDate ? new Date(task.dueDate) : todayBase
    const base = task.recurrence === 'annual' ? originalBase : todayBase

    let nextDate
    const cfg = task.recurrenceConfig || {}
    switch (task.recurrence) {
      case 'daily': {
        const every = cfg.every || 1
        nextDate = addDays(base, every)
        break
      }
      case 'weekly': {
        // Si hay días específicos, buscar el siguiente día configurado
        const days = cfg.days?.length ? cfg.days : [1, 2, 3, 4, 5]
        let candidate = addDays(base, 1)
        for (let i = 0; i < 8; i++) {
          if (days.includes(candidate.getDay())) { nextDate = candidate; break }
          candidate = addDays(candidate, 1)
        }
        if (!nextDate) nextDate = addWeeks(base, 1)
        break
      }
      case 'monthly': {
        const dayOfMonth = cfg.dayOfMonth || base.getDate()
        const nm = addMonths(base, 1)
        nm.setDate(Math.min(dayOfMonth, new Date(nm.getFullYear(), nm.getMonth() + 1, 0).getDate()))
        nextDate = nm
        break
      }
      case 'annual': nextDate = addYears(base, 1); break
      default: nextDate = addDays(base, 1)
    }

    // Extraer solo los campos seguros (sin id ni timestamps originales)
    const { id, createdAt, updatedAt, completedAt, dueDate, startDate, ...taskBase } = task

    const newRef = doc(collection(db, TASKS_COL))
    batch.set(newRef, {
      ...taskBase,
      status: 'not_started',
      completedAt: null,
      dueDate: Timestamp.fromDate(nextDate),
      startDate: Timestamp.fromDate(nextDate),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      parentTaskId: task.id,
    })
  }
  await batch.commit()
}
