# Pendientes

## Login con Google (migración desde PIN)

- [x] Habilitar proveedor Google en Firebase Console (confirmado habilitado)
- [x] Autorizar dominio `imanollopezgonzalez-del.github.io` en Authorized domains
- [x] Imanol vinculó su cuenta de Google (se borró una cuenta huérfana que había quedado de un intento previo fallido)
- [x] Mostrar "Ajustes" en el menú a todos los usuarios, no solo admin
- [ ] Iván: confirmar que los adjuntos de mail ya funcionan (custom claims + refresh de token) y vincular su cuenta de Google desde Ajustes
- [ ] Rodrigo: vincular su cuenta de Google desde Ajustes (ya tiene acceso al menú)
- [ ] Una vez Iván y Rodrigo confirmen vinculado: sacar el login con usuario+PIN de `src/pages/Login.jsx` (quedó como puente temporal, no es el diseño final)

## Notas técnicas para el próximo problema de "no tengo permiso" en Storage/mailing

Si vuelve a aparecer `storage/unauthorized` al subir adjuntos:
1. Es casi siempre el token de sesión con custom claims desactualizados (`companyId`/`role`/`crmAccess` — ver `functions/customClaims.js`).
2. Primero pedir cerrar sesión y volver a entrar (login nuevo siempre trae token fresco).
3. Si persiste, verificar en Cloud Functions logs que `syncUserClaims` corrió sin error para ese usuario.
4. Como último recurso, setear los claims directo con la MCP tool `auth_update_user` (companyId, role, crmAccess) sin depender del trigger.

## Otros pendientes de otras sesiones

- Google Maps: si el mapa/autocompletado deja de andar, revisar que `VITE_GOOGLE_MAPS_API_KEY` siga como secret en GitHub Actions y que la API de Places siga habilitada en Google Cloud Console para esa key.
