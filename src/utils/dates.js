import { format, isToday, isTomorrow, isThisWeek, isThisMonth, isPast, differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { es } from 'date-fns/locale'

export const formatDate = (date) => {
  if (!date) return '—'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return format(d, 'dd MMM yyyy', { locale: es })
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  const d = date?.toDate ? date.toDate() : new Date(date)
  return format(d, "dd MMM yyyy 'a las' HH:mm", { locale: es })
}

export const formatRelative = (date) => {
  if (!date) return '—'
  const d = date?.toDate ? date.toDate() : new Date(date)
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  const diff = differenceInDays(d, new Date())
  if (diff < 0) return `Hace ${Math.abs(diff)} días`
  if (diff < 7) return `En ${diff} días`
  return formatDate(d)
}

export const isOverdue = (date, status) => {
  if (!date || status === 'done') return false
  const d = date?.toDate ? date.toDate() : new Date(date)
  return isPast(endOfDay(d))
}

export const isDueSoon = (date, status) => {
  if (!date || status === 'done') return false
  const d = date?.toDate ? date.toDate() : new Date(date)
  const diff = differenceInDays(d, new Date())
  return diff >= 0 && diff <= 2
}

export const getDateRange = (view) => {
  const now = new Date()
  switch (view) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) }
    case 'week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month': return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'year': return { start: startOfYear(now), end: endOfYear(now) }
    default: return null
  }
}

export const getNextRecurrenceDate = (task) => {
  const base = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate)
  switch (task.recurrence) {
    case 'daily': return addDays(base, 1)
    case 'weekly': return addWeeks(base, 1)
    case 'monthly': return addMonths(base, 1)
    case 'annual': return addYears(base, 1)
    default: return null
  }
}

export const toInputDate = (date) => {
  if (!date) return ''
  const d = date?.toDate ? date.toDate() : new Date(date)
  return format(d, 'yyyy-MM-dd')
}

export const fromInputDate = (str) => {
  if (!str) return null
  return new Date(str + 'T00:00:00')
}

export const formatShortDate = (date) => {
  if (!date) return ''
  const d = date?.toDate ? date.toDate() : new Date(date)
  return format(d, 'dd/MM', { locale: es })
}
