importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js')

// Firebase client config — es pública y segura tenerla en el SW
const firebaseConfig = {
  apiKey: "AIzaSyCI9EKHypE4XqqJek4sDqVtNCLvtlKdKbU",
  authDomain: "gestion-tareas-pariggi.firebaseapp.com",
  projectId: "gestion-tareas-pariggi",
  storageBucket: "gestion-tareas-pariggi.firebasestorage.app",
  messagingSenderId: "736910221224",
  appId: "1:736910221224:web:4526fd119398843581c79d"
}

firebase.initializeApp(firebaseConfig)
const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'Gestión de Tareas', {
    body: body || 'Tienes una nueva notificación',
    icon: '/task-tracker/favicon.svg',
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
