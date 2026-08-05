const { HttpsError } = require('firebase-functions/v2/https')
const { getFirestore } = require('firebase-admin/firestore')

// Replica la lógica de hasCrm() + myCompany() de firestore.rules, del lado del servidor.
async function requireCrmUser(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Iniciá sesión para continuar')

  const db = getFirestore()
  const snap = await db.doc(`users/${uid}`).get()
  if (!snap.exists) throw new HttpsError('permission-denied', 'Usuario no encontrado')

  const data = snap.data()
  const hasCrm = data.role === 'admin' || data.crmAccess === true
  if (!hasCrm) throw new HttpsError('permission-denied', 'Sin acceso al CRM')

  return { uid, companyId: data.companyId, role: data.role, displayName: data.displayName || data.email || uid }
}

module.exports = { requireCrmUser }
