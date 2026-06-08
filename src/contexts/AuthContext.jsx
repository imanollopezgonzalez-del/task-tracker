import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { auth, db } from '../firebase'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, collection, serverTimestamp,
} from 'firebase/firestore'
import { getUserProfile } from '../services/users'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
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

  const register = async (email, password, displayName, companyCode) => {
    registeringRef.current = true
    try {
      // 1. Crear usuario en Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName })

      let role = 'member'
      let companyId = null

      if (companyCode?.trim()) {
        // Unirse a empresa existente
        const companySnap = await getDoc(doc(db, 'companies', companyCode.trim()))
        if (!companySnap.exists()) throw new Error('Código de empresa incorrecto')
        companyId = companyCode.trim()
        role = 'member'
      } else {
        // Crear empresa nueva — este usuario es el admin
        const companyRef = doc(collection(db, 'companies'))
        await setDoc(companyRef, {
          name: 'Mi Empresa',
          ownerUid: cred.user.uid,
          createdAt: serverTimestamp(),
        })
        companyId = companyRef.id
        role = 'admin'
      }

      // 2. Crear perfil de usuario con rol correcto (todo en una escritura)
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName,
        role,
        companyId,
        fcmToken: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 3. Cargar perfil en contexto
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
    return profile
  }

  const value = { currentUser, userProfile, loading, register, login, logout, refreshProfile }
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}
