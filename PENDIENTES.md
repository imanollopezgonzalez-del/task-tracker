# Pendientes

## Login con Google (migración desde PIN)

- [x] Habilitar proveedor Google en Firebase Console (confirmado habilitado)
- [x] Autorizar dominio `imanollopezgonzalez-del.github.io` en Authorized domains
- [x] Imanol vinculó su cuenta de Google (se borró una cuenta huérfana que había quedado de un intento previo fallido)
- [x] Mostrar "Ajustes" en el menú a todos los usuarios, no solo admin
- [ ] Iván: vincular su cuenta de Google desde Ajustes (los adjuntos de mail ya confirmados funcionando)
- [ ] Rodrigo: vincular su cuenta de Google desde Ajustes (ya tiene acceso al menú)
- [ ] Una vez Iván y Rodrigo confirmen vinculado: sacar el login con usuario+PIN de `src/pages/Login.jsx` (quedó como puente temporal, no es el diseño final)

## Mailing — adjuntos y Drive

- [x] Límite de adjunto subido de 10MB a 20MB (el límite real de Gmail es 25MB post-base64)
- [x] Memoria de `sendMail`/`sendBulkMail` subida a 512MiB (crasheaba con "internal" en adjuntos pesados)
- [x] Botón "Desde Drive" en ComposeEmailModal — inserta un link en vez de adjuntar (sin límite de tamaño real, mismo enfoque que usa Gmail)
- [ ] **Habilitar "Google Picker API" en Google Cloud Console** (mismo proyecto que `VITE_GOOGLE_MAPS_API_KEY`) — sin esto el botón "Desde Drive" tira error al abrir
- [ ] Crear las carpetas de Drive de Pollo Cocido y de Pastas Pariggi, y pasar **email de Google + link de la carpeta** de cada una para cargarlas en `src/config/driveDefaultFolders.js` (así el picker abre directo en la carpeta de esa empresa en vez de la raíz de Drive)
- [ ] **Cambio de enfoque pedido**: pasar de "elegir cuenta de Google en el momento cada vez que se abre el picker" a **conexiones de Drive guardadas** (como ya funciona "Conectar cuenta de Gmail") — un desplegable para elegir la cuenta ya conectada, sin tener que volver a iniciar sesión cada vez que se quiere adjuntar algo de Drive. Requiere agregar el scope `drive.readonly` a la conexión de Gmail existente (o una conexión separada) y guardar el token asociado, similar al flujo de `connectGmailAccount`.

## Notas técnicas — diagnóstico de "no tengo permiso" en Storage/mailing

Si vuelve a aparecer `storage/unauthorized` al subir adjuntos, puede ser CUALQUIERA de estas dos causas (Firebase devuelve el mismo error genérico para ambas, no se puede distinguir por el mensaje):

**A) Custom claims desactualizados** (`companyId`/`role`/`crmAccess` — ver `functions/customClaims.js`):
1. Pedir cerrar sesión y volver a entrar (login nuevo siempre trae token fresco). Vincular Google YA fuerza un refresh de token también (fix de hoy en `linkGoogleAccount`).
2. Si persiste, verificar en Cloud Functions logs que `syncUserClaims` corrió sin error para ese usuario.
3. **Importante**: `setCustomUserClaims` reemplaza TODO el objeto de claims, no lo mezcla. Nunca usar `auth_update_user` con un solo claim por llamada para "arreglar a mano" — pisa los otros. Si hace falta forzar un resync, tocar un campo cualquiera del doc `users/{uid}` en Firestore (dispara `syncUserClaims`, que ahora siempre re-setea las 3 claims juntas, sin atajos que se las salteen).

**B) El archivo supera el límite de tamaño de `storage.rules`** (hoy 20MB) — revisar el tamaño real del archivo antes de asumir que es un tema de permisos.

## Otros pendientes de otras sesiones

- Google Maps: si el mapa/autocompletado deja de andar, revisar que `VITE_GOOGLE_MAPS_API_KEY` siga como secret en GitHub Actions y que la API de Places siga habilitada en Google Cloud Console para esa key.
