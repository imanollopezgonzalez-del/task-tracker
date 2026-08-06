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

  // Antes esto se salteaba si companyId/role/crmAccess no habían cambiado en Firestore
  // (optimización para no llamar al Admin SDK de más). El problema: setCustomUserClaims
  // REEMPLAZA todo el objeto de claims, no lo mezcla, y como esos campos siempre están
  // presentes en cada escritura de perfil, el "sin cambios" también se activaba de
  // pura casualidad justo cuando los claims reales del token estaban corruptos por un
  // ajuste manual previo (ej. varias llamadas de auth_update_user, cada una pisando la
  // anterior) — la función veía Firestore sin cambios y nunca los volvía a escribir. Se
  // saca el atajo: escribir de más es barato, dejar el token desincronizado no.
  await getAuth().setCustomUserClaims(uid, claims)
})

module.exports = { syncUserClaims }
