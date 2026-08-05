# Envío masivo, plantillas y campañas — Mailing (Fase 1)

**Fecha:** 2026-08-05
**Estado:** Aprobado para pasar a plan de implementación

## Contexto

El módulo de Mailing (conectar Gmail, compositor individual, historial) ya está en
producción. Este documento define la Fase 1 de la ampliación: envío masivo con
filtros del CRM, plantillas reutilizables, y un historial de campañas unificado
(individual + masivo en la misma vista).

Referencia de UX: capturas de Monday CRM ("Seguimiento de e-mails masivos") que el
usuario usaba antes — lista de campañas con % entregado/abierto/click/fallo, y un
panel de detalle con la lista real de destinatarios por estado.

Todo vive dentro de la página **Mailing** ya existente (`/crm/mailing`) — sin rutas
nuevas.

## Fuera de alcance de esta fase (pendientes, deliberadamente diferidos)

- **Tracking de apertura y clicks** (píxel de seguimiento + reescritura de links).
  Requiere 2 endpoints HTTP públicos nuevos (no-callable) y reescritura del HTML
  antes de enviar. Se construye en una Fase 2 separada, una vez que el envío
  masivo esté probado en producción.
- **Baja de suscripción (unsubscribe)** — depende del mismo tracking de Fase 2:
  necesita un endpoint público, un link en cada email, y un campo en los
  registros del CRM para excluir automáticamente a quien se dio de baja de
  futuros envíos masivos.
- **Envíos programados** (pestaña "Scheduled" de Monday) — el envío masivo de
  esta fase es siempre "mandar ahora". La programación futura queda cubierta
  más adelante por el agente semanal externo (n8n), que el usuario conecta por
  su cuenta una vez que esta fase esté terminada.
- **Agente externo de envío recurrente** — fuera de este repo. El diseño de
  `sendBulkMail` deja la lógica de "mandar a una lista con una plantilla" como
  una función interna reutilizable, para que un futuro trigger HTTP/programado
  la pueda invocar sin reconstruir nada.

## Modelo de datos (Firestore)

### `mailTemplates/{templateId}`
```
companyId: string
name: string                    // nombre interno, ej. "Ravioles Espinaca"
subject: string
mode: 'rich' | 'html'
richBodyHtml: string | null     // si mode = 'rich' (salida del editor Tiptap)
htmlSource: string | null       // si mode = 'html' (HTML pegado tal cual)
createdBy: uid
createdAt, updatedAt
```
Reglas: lectura/escritura para usuarios con `hasCrm()` de la misma `companyId`
(igual patrón que `leads`).

### `mailCampaigns/{campaignId}`
Un documento por cada "lanzamiento" — tanto un email individual (`sendMail`)
como uno masivo (`sendBulkMail`) crean uno, para que el historial quede
unificado.
```
companyId: string
subject: string
fromAccountId: string
fromEmail: string
sentBy: uid
sentByName: string
templateId: string | null       // si se mandó desde una plantilla guardada
audienceType: 'individual' | 'leads' | 'contactos' | 'clientes'
recipientCount: number
sentCount: number
failedCount: number
status: 'sending' | 'done'
createdAt
```
Reglas: lectura para `hasCrm()` de la misma `companyId`. Escritura: solo Cloud
Functions (Admin SDK).

### `mailingLogs/{logId}` (existente, se le agrega un campo)
```
...campos existentes...
campaignId: string    // nuevo — vincula cada log a su mailCampaign
```

## Backend (Cloud Functions, `functions/mailing.js`)

### `sendMail` (existente, modificada)
Al enviar, además de loguear en `mailingLogs`, crea un `mailCampaign` con
`recipientCount: 1`, `audienceType: 'individual'`, y setea ese `campaignId`
en su propio `mailingLogs` — así un envío suelto aparece en el historial con
el mismo formato que uno masivo, con el mismo campo de vínculo.

### `sendBulkMail` (nueva)
Input: `{ fromAccountId, subject, htmlBody, recipients: [{ email, nombre, empresa }], templateId? }`

- Valida `recipients.length <= 500` (límite diario de Gmail en cuenta
  personal) — si se supera, `HttpsError('invalid-argument', ...)` sin mandar
  nada. El front también corta antes con el mismo límite (defensa en
  profundidad, no solo UX).
- Crea el `mailCampaign` con `status: 'sending'`.
- Loop secuencial: por cada destinatario, reemplaza `{{nombre}}` y
  `{{empresa}}` en `subject`/`htmlBody` (reemplazo de texto simple, sin
  templating engine), arma el MIME y lo manda vía Gmail API. Cada resultado
  (éxito o error) se loguea en `mailingLogs` con el `campaignId`, y actualiza
  los contadores del `mailCampaign` de forma incremental (no todo al final),
  para que si la función se corta a mitad de camino por timeout el progreso
  ya hecho quede reflejado.
- `timeoutSeconds: 540` (máximo de 2nd gen) para tener margen con listas
  grandes.
- Attachments: se descargan una sola vez de Storage (no por destinatario) y
  se reusan en cada envío individual.
- El loop de "mandar a lista con reemplazo de campos" se escribe como función
  interna separada de la envoltura `onCall`, para que un futuro trigger
  (agente externo) la pueda invocar sin duplicar lógica.

## Frontend

### `src/pages/crm/Mailing.jsx`
Se agregan dos secciones nuevas a la página existente:

**Plantillas** — lista con crear/editar/borrar. El modal de creación
(`TemplateModal.jsx`, nuevo) deja elegir entre editor visual (reusa el editor
compartido, ver abajo) o pegar HTML en un textarea. Dos botones "Insertar
nombre" / "Insertar empresa" en el modo visual insertan los tags
`{{nombre}}` / `{{empresa}}` en la posición del cursor.

**Envío masivo** (`BulkSendPanel.jsx`, nuevo) — flujo dentro de la misma
página:
1. Selector de tipo de registro: Leads / Contactos / Clientes.
2. Los mismos filtros que ya existen en esas páginas (tipo de cliente,
   producto, responsable; en Clientes también Nuevos/Antiguos/Perdidos),
   reconstruidos acá reusando las constantes de `crmConstants.js`.
3. Contador en vivo de destinatarios que matchean. Los registros sin ningún
   email cargado (mismo fallback que ya usan las fichas de detalle:
   `contactos[0].emails[0]` → `email` del registro) se excluyen
   automáticamente de la lista a enviar, y el contador aclara cuántos quedaron
   afuera por eso (ej. "48 matchean el filtro · 3 sin email, no reciben").
4. Selector de plantilla guardada (opcional) o escribir desde cero.
5. Si el conteo supera 500: bloquea el botón de enviar con aviso.
6. Confirmar y enviar → llama a `sendBulkMail`.

**Historial** (sección existente, reemplazada) — en vez de una fila por
email individual, pasa a listar `mailCampaigns` (fecha, asunto, quién,
destinatarios, % entregado, % fallido). Al hacer click en una fila se abre
un panel de detalle con las métricas y, expandible, la lista real de
`mailingLogs` de esa campaña agrupados en "Se envió con éxito" / "No se pudo
enviar" (sin abierto/clic todavía, eso es Fase 2).

### Componente compartido: editor de email
El editor de texto enriquecido (Tiptap + toolbar) hoy vive solo dentro de
`ComposeEmailModal.jsx`. Al pasar a usarse también en `TemplateModal.jsx` y
`BulkSendPanel.jsx` (3 lugares), se extrae a un componente compartido
`src/components/mailing/EmailBodyEditor.jsx` que expone el editor + toolbar +
manejo de imágenes/paste, para no triplicar ese bloque.

## Errores y casos límite

- Envío masivo con 0 destinatarios (filtro no matchea nada): botón de enviar
  deshabilitado, sin llamar a la función.
- Falla de Gmail a mitad del loop (ej. rate limit): se loguea como error en
  `mailingLogs` para ese destinatario puntual y el loop sigue con el resto —
  un fallo individual no aborta la campaña completa.
- Plantilla en modo `html` sin los tags `{{nombre}}`/`{{empresa}}`: se manda
  igual, simplemente no hay reemplazo (el usuario decide si los usa o no).
- Adjuntos en envío masivo: mismo límite de tamaño y validación de `path` ya
  existente en `sendMail` (fix de SSRF ya aplicado), reusado en `sendBulkMail`.

## Testing

- Build de producción (`npm run build`) sin errores antes de cada commit,
  como ya se viene haciendo en este repo (no hay suite de tests automatizada).
- Prueba manual end-to-end antes de dar la fase por terminada: crear una
  plantilla en cada modo, armar un envío masivo a un filtro chico (ej. 2-3
  contactos de prueba), confirmar que el historial muestra la campaña
  agrupada y que el detalle lista los destinatarios reales.
