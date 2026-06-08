importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js')

// These are injected at deploy time via GitHub Actions secrets or replaced manually
const firebaseConfig = {
  apiKey: self.FIREBASE_API_KEY || '',
  authDomain: self.FIREBASE_AUTH_DOMAIN || '',
  projectId: self.FIREBASE_PROJECT_ID || '',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: self.FIREBASE_APP_ID || '',
}

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {}
    self.registration.showNotification(title || 'Gestión de Tareas', {
      body: body || 'Tienes una nueva notificación',
      icon: '/task-tracker/favicon.svg',
      badge: '/task-tracker/favicon.svg',
      tag: payload.data?.taskId,
      data: payload.data,
    })
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const taskId = event.notification.data?.taskId
    const url = taskId ? `/#/tasks/${taskId}` : '/'
    event.waitUntil(clients.openWindow(url))
  })
}
