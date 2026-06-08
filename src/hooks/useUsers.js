import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeCompanyUsers } from '../services/users'

export function useUsers() {
  const { userProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userProfile?.companyId) { setUsers([]); setLoading(false); return }
    const unsub = subscribeCompanyUsers(userProfile.companyId, (u) => { setUsers(u); setLoading(false) })
    return unsub
  }, [userProfile?.companyId])

  return { users, loading }
}
