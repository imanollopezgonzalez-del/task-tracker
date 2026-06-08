import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { subscribeTasks, subscribeMyTasks } from '../services/tasks'

const TaskContext = createContext(null)
export const useTasks = () => useContext(TaskContext)

export function TaskProvider({ children }) {
  const { currentUser, userProfile } = useAuth()
  const [allTasks, setAllTasks] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const companyId = userProfile?.companyId

  useEffect(() => {
    if (!currentUser || !companyId) { setAllTasks([]); setMyTasks([]); setLoading(false); return }
    setLoading(true)
    const unsub1 = subscribeTasks(companyId, (tasks) => { setAllTasks(tasks); setLoading(false) })
    const unsub2 = subscribeMyTasks(currentUser.uid, companyId, setMyTasks)
    return () => { unsub1(); unsub2() }
  }, [currentUser, companyId])

  return (
    <TaskContext.Provider value={{ allTasks, myTasks, loading, companyId }}>
      {children}
    </TaskContext.Provider>
  )
}
