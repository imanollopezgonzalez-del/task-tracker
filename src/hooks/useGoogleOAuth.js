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

  // Access token de corta duración (no se guarda, solo vive en memoria mientras el picker
  // está abierto) para que el Google Picker pueda listar archivos de Drive. Deliberadamente
  // separado del flujo de "Conectar cuenta de Gmail": ese guarda un refresh_token server-side
  // para poder mandar mail más adelante sin volver a pedir permiso; esto es un permiso
  // puntual de lectura de Drive que se pide de nuevo cada vez que se abre el picker, así el
  // usuario puede elegir en el momento con qué cuenta de Google navega Drive (Pollo Cocido,
  // Pariggi, la que sea) sin tener que preconectarlas.
  const requestDriveAccessToken = async () => {
    await loadGisScript()

    return new Promise((resolve, reject) => {
      const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID
      if (!clientId) {
        reject(new Error('Falta configurar VITE_GOOGLE_OAUTH_CLIENT_ID'))
        return
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error))
            return
          }
          resolve(response.access_token)
        },
      })
      client.requestAccessToken()
    })
  }

  return { requestGmailAuthCode, requestDriveAccessToken }
}
