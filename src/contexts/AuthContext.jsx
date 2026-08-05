import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { auth, db } from '../firebase'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  GoogleAuthProvider, signInWithPopup, linkWithPopup,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc, collection, serverTimestamp,
} from 'firebase/firestore'
import { getUserProfile, createUserProfile, getUsuarioAutorizado } from '../services/users'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
const googleProvider = new GoogleAuthProvider()

// El Cloud Function que sincroniza custom claims (companyId/role/crmAccess) tarda un
// segundo o dos en correr después de escribir el perfil. Forzamos un refresh del ID token
// pasado ese margen para que las Storage Rules vean los claims nuevos sin esperar la
// renovación automática (~1h) ni requerir un logout/login.
const scheduleTokenRefresh = (user) => {
  if (!user) return
  setTimeout(() => { user.getIdToken(true).catch(() => {}) }, 3000)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const registeringRef = useRef(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)
      if (user && !registeringRef.current) {
        // Fuerza un refresh del ID token en cada arranque de sesión: los custom claims
        // (companyId/role/crmAccess, ver functions/customClaims.js) solo llegan al token
        // cacheado del navegador cuando este se renueva. Sin esto, una sesión que ya
        // estaba abierta antes de un cambio de rol/empresa puede quedar con Storage Rules
        // rotas (ve companyId/role viejos o vacíos) hasta que el token expire solo (~1h).
        await user.getIdToken(true).catch(() => {})
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
      scheduleTokenRefresh(cred.user)
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

  // Login con Google. Cubre dos casos:
  // 1. Cuenta ya vinculada (via linkGoogleAccount) a un uid existente -> ya tiene perfil, sigue normal.
  // 2. Primer ingreso con Google de alguien nunca antes registrado -> solo entra si un admin
  //    lo autorizó previamente (colección usuariosAutorizados), y ahí se crea su perfil.
  const loginWithGoogle = async () => {
    registeringRef.current = true
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      const existing = await getUserProfile(cred.user.uid)
      if (existing) {
        setUserProfile(existing)
        return cred.user
      }

      const email = cred.user.email?.toLowerCase()
      const autorizado = email ? await getUsuarioAutorizado(email) : null
      if (!autorizado) {
        await signOut(auth)
        const err = new Error('Tu cuenta de Google no tiene acceso a esta herramienta. Pedile a un admin que te agregue.')
        err.code = 'auth/google-not-authorized'
        throw err
      }

      // role/companyId/crmAccess se pasan todos en esta única escritura de creación: las
      // reglas de Firestore solo permiten setear estos campos al CREAR el propio perfil,
      // no en updates posteriores (evita que un usuario se autoescale rol/empresa/acceso
      // CRM más adelante, algo que además ahora terminaría reflejado en los custom claims).
      const profile = await createUserProfile(cred.user, {
        displayName: cred.user.displayName,
        role: autorizado.role,
        companyId: autorizado.companyId,
        crmAccess: autorizado.crmAccess,
      })
      const finalProfile = await getUserProfile(cred.user.uid)
      setUserProfile(finalProfile)
      scheduleTokenRefresh(cred.user)
      return cred.user
    } finally {
      registeringRef.current = false
    }
  }

  // Vincula la cuenta de Google del usuario YA logueado (con PIN) a su mismo uid,
  // para poder migrar de login PIN a Google sin perder tareas/datos asignados a ese uid.
  const linkGoogleAccount = async () => {
    if (!auth.currentUser) throw new Error('No hay sesión activa')
    const result = await linkWithPopup(auth.currentUser, googleProvider)
    const email = result.user.email?.toLowerCase()
    if (email) {
      await setDoc(doc(db, 'users', result.user.uid), { email }, { merge: true })
      await refreshProfile()
    }
    return result.user
  }

  const logout = () => signOut(auth)

  const refreshProfile = async () => {
    if (!currentUser) return
    const profile = await getUserProfile(currentUser.uid)
    setUserProfile(profile)
    return profile
  }

  const value = { currentUser, userProfile, loading, register, login, loginWithGoogle, linkGoogleAccount, logout, refreshProfile }
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}
