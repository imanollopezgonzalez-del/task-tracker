import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { subscribeNotifications, markAsRead, markAllAsRead } from '../services/notifications'

const NotificationContext = createContext(null)
export const useNotifications = () => useContext(NotificationContext)

export function NotificationProvider({ children }) {
  const { currentUser } = useAuth()
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!currentUser) { setNotifications([]); return }
    const unsub = subscribeNotifications(currentUser.uid, setNotifications)
    return unsub
  }, [currentUser])

  const unreadCount = notifications.filter((n) => !n.read).length

  const read = (id) => markAsRead(id)
  const readAll = () => currentUser && markAllAsRead(currentUser.uid)

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, read, readAll }}>
      {children}
    </NotificationContext.Provider>
  )
}
