import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { auth } from '../firebase'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth'
import { createUserProfile, getUserProfile, createCompany, joinCompany } from '../services/users'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Flag para evitar que onAuthStateChanged sobreescriba el perfil durante registro
  const registeringRef = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user && !registeringRef.current) {
        const profile = await getUserProfile(user.uid)
        setUserProfile(profile)
      } else if (!user) {
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // register maneja todo en secuencia: crear usuario → empresa → perfil con rol correcto
  const register = async (email, password, displayName, companyCode) => {
    registeringRef.current = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })

      let role = 'member'
      let companyId = null

      if (companyCode?.trim()) {
        await joinCompany(cred.user.uid, companyCode.trim())
        companyId = companyCode.trim()
      } else {
        companyId = await createCompany('Mi Empresa', cred.user.uid)
        role = 'admin'
      }

      await createUserProfile(cred.user, { displayName, role, companyId })
      const profile = await getUserProfile(cred.user.uid)
      setUserProfile(profile)
      return cred.user
    } finally {
      registeringRef.current = false
    }
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
