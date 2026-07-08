import { db } from '../firebase'
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'

const SETTINGS_COL = 'crmSettings'

export const subscribeObjetivos = (companyId, callback) => {
  const ref = doc(db, SETTINGS_COL, companyId)
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data().objetivosKg || {} : {})
  }, (err) => console.error('subscribeObjetivos error:', err))
}

export const setObjetivoMes = async (companyId, mesKey, producto, valorKg) => {
  const ref = doc(db, SETTINGS_COL, companyId)
  const snap = await getDoc(ref)
  const objetivosKg = snap.exists() ? (snap.data().objetivosKg || {}) : {}
  const mesActual = objetivosKg[mesKey] || {}
  // Se arma el mapa completo en JS y se reemplaza entero (con merge:true a nivel del doc)
  // para no depender de que Firestore interprete keys con puntos como rutas anidadas.
  await setDoc(ref, {
    objetivosKg: {
      ...objetivosKg,
      [mesKey]: { ...mesActual, [producto]: valorKg },
    },
  }, { merge: true })
}
