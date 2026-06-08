# Gestión de Tareas — Pollo Cocido & Pastas Pariggi

Sistema de seguimiento y doble control de tareas para equipos de trabajo.

## Funcionalidades

- **Prioridades**: Urgente · Importante · No Urgente
- **Estados**: Sin comenzar · En curso · Pend. Respuesta · Pend. Ajustes · Finalizado
- **Tareas únicas y recurrentes** (diaria, semanal, mensual, anual)
- **Multi-usuario**: asignar tarea + verificador
- **Notificaciones**: in-app y push
- **Panel personal** por frecuencia (hoy, semana, mes, año)
- **KPIs y métricas** de rendimiento del equipo
- **Comentarios** en cada tarea
- **Histórico** de tareas completadas

---

## Configuración — Paso a paso

### 1. Crea un proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto (ej. `gestion-tareas-pariggi`)
3. **Authentication** → Activar proveedor "Correo/Contraseña"
4. **Firestore Database** → Crear base de datos en modo producción
5. Pega las siguientes reglas de seguridad en Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /companies/{companyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
      match /comments/{commentId} {
        allow read, write: if request.auth != null;
      }
    }
    match /notifications/{notifId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.recipientId;
      allow create: if request.auth != null;
    }
  }
}
```

6. **Configuración del proyecto** → ⚙️ → General → Tus apps → App web → Copia el objeto `firebaseConfig`

### 2. Configura los secretos en GitHub

En tu repositorio → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Nombre | Valor |
|--------|-------|
| `VITE_FIREBASE_API_KEY` | apiKey de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
| `VITE_FIREBASE_APP_ID` | appId |
| `VITE_FIREBASE_VAPID_KEY` | (opcional, para notificaciones push) |

### 3. Activa GitHub Pages

Repositorio → **Settings** → **Pages** → Source: **GitHub Actions**

### 4. Primer deploy

Haz un push a `main` o ve a **Actions** → Run workflow.

La app estará en: `https://imanollopezgonzalez-del.github.io/task-tracker/`

### 5. Primer usuario (Administrador)

1. Entra a la app → pestaña "Registrarse"
2. Rellena tu nombre, email y contraseña
3. Elige "Crear empresa" y pon el nombre
4. Tendrás rol de Administrador automáticamente

### 6. Añadir empleados

1. Ve a **Equipo** → copia el **ID de empresa**
2. Comparte ese ID con tus empleados
3. Ellos se registran eligiendo "Unirse a empresa" y pegan el ID

---

## Desarrollo local

```bash
cp .env.example .env
# Edita .env con tus credenciales de Firebase
npm install
npm run dev
```

---

## Tecnologías

- React 19 + Vite · Tailwind CSS (paleta Claude/Anthropic) · Firebase · Recharts · GitHub Pages
