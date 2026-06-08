import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../firebase'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth'
import { createUserProfile, getUserProfile } from '../services/users'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const profile = await getUserProfile(user.uid)
        setUserProfile(profile)
      } else {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const register = async (email, password, displayName, companyData) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    const profile = await createUserProfile(cred.user, { displayName, ...companyData })
    setUserProfile(profile)
    return cred.user
  }

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const profile = await getUserProfile(cred.user.uid)
    setUserProfile(profile)
    return cred.user
  }

  const logout = () => signOut(auth)

  const refreshProfile = async () => {
    if (!currentUser) return
    const profile = await getUserProfile(currentUser.uid)
    setUserProfile(profile)
  }

  const value = { currentUser, userProfile, loading, register, login, logout, refreshProfile }
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}
