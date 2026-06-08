# Tablero Tareas — Pollo Cocido & Pastas Pariggi

**Repo:** https://github.com/imanollopezgonzalez-del/task-tracker  
**URL live:** https://imanollopezgonzalez-del.github.io/task-tracker/  
**Estado:** Versión definitiva — junio 2026

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| Estilos | Tailwind CSS (paleta warm/naranja personalizada) |
| Base de datos | Firebase Firestore (tiempo real con onSnapshot) |
| Autenticación | Firebase Auth (email/password interno) |
| Notificaciones push | Firebase Cloud Messaging (FCM) |
| Gráficos | Recharts |
| Fechas | date-fns |
| Hosting | GitHub Pages vía GitHub Actions |
| Router | HashRouter (obligatorio para GitHub Pages) |

---

## Diseño

- Paleta crema cálida `#FAF8F5` + naranja marca `#D97757` + oscuro `#1C1917`
- Logo sidebar: fondo naranja + checkbox con tick blanco
- Favicon: tick naranja `#D97757`
- Nunca usar la palabra "empleado" → siempre "Colaborador"

---

## Autenticación

- Login: **nombre de usuario** + **PIN de 6 dígitos** (no se muestra email)
- Internamente se genera: `nombre@tasks.internal`
- Registro sin código de empresa → crea empresa nueva → usuario = **admin**
- Registro con código de empresa → se une a empresa existente → usuario = **colaborador**

---

## Roles

| Rol | Acceso |
|---|---|
| `admin` | Tareas (todo el equipo), Calendario, KPIs, Equipo, Ajustes |
| `member` | Tareas (solo las propias), Calendario |

---

## Página principal: Tareas

Una sola página (`src/pages/Tasks.jsx`) para ambos roles.

### Lo que ve el admin
- Estadísticas generales (completadas / en curso / vencidas / urgentes)
- Desplegable **"Ver de:"** → Mis tareas / Todo el equipo / persona individual
- Selector de vista: **Hoy / Esta semana / Este mes / Completadas**
- 3 columnas con botón **Filtrar** (búsqueda + urgencia) y **Ordenar** por columna

### Lo que ve el colaborador
- Saludo con avatar + fecha
- Sus estadísticas personales
- Mismas vistas y columnas (sin el desplegable de equipo)

### 3 columnas
1. **Tareas** — tareas únicas asignadas
2. **Recurrentes** — tareas de tipo recurrente asignadas
3. **Supervisión** — tareas donde eres el verificador pero no el asignado

---

## Tipos de tarea

| Campo | Valores |
|---|---|
| Urgencia | Urgente / Importante / No urgente |
| Estado | Sin comenzar / En curso / Pend. Respuesta / Pend. Ajustes / Finalizado |
| Tipo | Única / Recurrente |
| Recurrencia | Diaria / Semanal / Mensual / Anual |

### Configuración de recurrencia (estilo Google Calendar)
- **Diaria:** cada N días
- **Semanal:** seleccionar días D L M X J V S
- **Mensual:** día del mes
- Al completar una recurrente → se marca como hecha y se crea la siguiente automáticamente

---

## Flujo de doble verificación

1. Tarea tiene un campo **"Verifica"** (supervisor asignado)
2. Asignado marca la tarea como hecha → pasa a **Pend. Respuesta** → notifica al supervisor
3. Supervisor la ve en su columna Supervisión con botón **"✓ Verificar y cerrar"**
4. Supervisor confirma → tarea pasa a **Finalizado**

---

## KPIs

Filtros: período / persona / urgencia / estado  
Período: esta semana, mes actual, mes anterior, año actual/anterior + mes específico + año específico  
Gráfico: evolución mes a mes (creadas vs completadas, últimos 12 meses)

---

## Panel de equipo (solo admin)

- Ver todos los colaboradores con su actividad
- Cambiar rol: admin ↔ colaborador
- Eliminar colaborador (2 confirmaciones)
- Código de empresa copiable para invitar nuevos colaboradores

---

## Firestore — colecciones

```
companies/{companyId}     → name, ownerUid, createdAt
users/{uid}               → uid, displayName, role, companyId, fcmToken
tasks/{taskId}            → companyId, title, priority, status, type,
                            recurrence, recurrenceConfig, assignedTo,
                            verifiedBy, dueDate, startDate, createdBy
notifications/{notifId}   → recipientId, taskId, type, senderName, read
```

---

## Reglas de Firestore

> El archivo `firestore.rules` está en la raíz del repo.  
> **Hay que pegarlas manualmente en Firebase Console → Firestore → Reglas → Publicar.**  
> Sin estas reglas, el admin no puede eliminar colaboradores.

---

## Despliegue (GitHub Actions)

Se activa automáticamente al hacer push a `main`.  
Requiere estos **7 secrets** en el repo de GitHub:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
```

---

## Mapa de archivos clave

```
src/
  App.jsx                        → rutas (/ redirige a /tasks)
  firebase.js                    → config desde variables de entorno
  contexts/
    AuthContext.jsx              → login, registro, manejo de sesión
    TaskContext.jsx              → suscripción a tareas en tiempo real
    NotificationContext.jsx      → notificaciones in-app
  pages/
    Login.jsx                    → username + PIN
    Tasks.jsx                    → página principal unificada (admin + colaborador)
    KPI.jsx                      → métricas con filtros
    CalendarView.jsx             → calendario mensual
    Admin.jsx                    → gestión del equipo
    Settings.jsx                 → ajustes de empresa y perfil
    TaskDetail.jsx               → detalle de tarea con comentarios
  services/
    tasks.js                     → CRUD + suscripciones + completeAndRecur
    users.js                     → buildUserEmail, CRUD usuarios
    notifications.js             → crear y suscribirse a notificaciones
  components/
    layout/Sidebar.jsx           → navegación por rol
    tasks/TaskCard.jsx           → tarjeta compacta de tarea
    tasks/TaskModal.jsx          → modal crear/editar tarea
    tasks/RecurrencePicker.jsx   → selector de recurrencia
    ui/Avatar.jsx                → avatar con color único por nombre
  hooks/
    useUsers.js                  → lista de usuarios de la empresa en tiempo real
  utils/
    constants.js                 → PRIORITIES, STATUSES
public/
  favicon.svg                    → tick naranja
  firebase-messaging-sw.js       → service worker para notificaciones push
firestore.rules                  → reglas de seguridad Firestore
.github/workflows/deploy.yml     → CI/CD a GitHub Pages
```

---

## Problemas resueltos

| Problema | Solución |
|---|---|
| Queries Firestore fallaban (índices) | Eliminar `orderBy`, ordenar en cliente |
| Usuario registrado como colaborador en vez de admin | Flag `registeringRef` evita race condition en `onAuthStateChanged` |
| Toast no aparecía en Login | Mover `Toaster` a `App.jsx` fuera del Layout autenticado |
| `completeAndRecur` rechazado por Firestore | Excluir `id` y timestamps al esparcir el objeto de tarea |
| PIN de 4 dígitos rechazado por Firebase | PIN cambiado a 6 dígitos (mínimo de Firebase Auth) |
| Eliminar colaborador no funcionaba | Reglas de Firestore no permitían al admin borrar docs ajenos → `firestore.rules` |
| Inicio y Tareas eran páginas separadas | Unificadas en `Tasks.jsx` para ambos roles |
