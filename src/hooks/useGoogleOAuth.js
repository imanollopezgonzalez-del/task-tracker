const GIS_SRC = 'https://accounts.google.com/gsi/client'

let scriptLoadingPromise = null
function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'))
      document.head.appendChild(script)
    })
  }
  return scriptLoadingPromise
}

export function useGoogleOAuth() {
  const requestGmailAuthCode = async () => {
    await loadGisScript()

    return new Promise((resolve, reject) => {
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
      if (!clientId) {
        reject(new Error('Falta configurar VITE_GOOGLE_OAUTH_CLIENT_ID'))
        return
      }

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.send openid email',
        ux_mode: 'popup',
        prompt: 'consent', // fuerza a que Google reemita el refresh_token en cada conexión
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error))
            return
          }
          resolve(response.code)
        },
      })
      client.requestCode()
    })
  }

  return { requestGmailAuthCode }
}
