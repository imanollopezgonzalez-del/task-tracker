const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { getAuth } = require('firebase-admin/auth')

// Mantiene companyId/role/crmAccess como custom claims del ID token de Firebase Auth.
// Storage Rules no puede leer Firestore de forma confiable (firestore.get() ahí devuelve
// "unauthorized" incluso con los permisos correctos), pero SÍ puede leer request.auth.token.*
// directo, sin ninguna lectura extra. Este trigger es lo que mantiene esos claims al día
// cada vez que cambia el perfil del usuario en Firestore.
const syncUserClaims = onDocumentWritten('users/{uid}', async (event) => {
  const { uid } = event.params
  const after = event.data?.after?.data()

  if (!after) {
    await getAuth().setCustomUserClaims(uid, null).catch(() => {})
    return
  }

  const claims = {
    companyId: after.companyId || null,
    role: after.role || 'member',
    crmAccess: after.crmAccess === true,
  }

  const before = event.data?.before?.data()
  const sinCambios = before
    && before.companyId === claims.companyId
    && before.role === claims.role
    && (before.crmAccess === true) === claims.crmAccess
  if (sinCambios) return

  await getAuth().setCustomUserClaims(uid, claims)
})

module.exports = { syncUserClaims }
