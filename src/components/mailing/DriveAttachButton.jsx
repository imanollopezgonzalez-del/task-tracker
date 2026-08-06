import { useState } from 'react'
import { HardDrive, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGoogleOAuth } from '../../hooks/useGoogleOAuth'
import { GOOGLE_MAPS_API_KEY } from '../../config/googleMaps'

const PICKER_API_SRC = 'https://apis.google.com/js/api.js'

let pickerLoadingPromise = null
function loadPickerLib() {
  if (window.google?.picker) return Promise.resolve()
  if (!pickerLoadingPromise) {
    pickerLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = PICKER_API_SRC
      script.async = true
      script.defer = true
      script.onload = () => window.gapi.load('picker', { callback: resolve })
      script.onerror = () => reject(new Error('No se pudo cargar el picker de Google Drive'))
      document.head.appendChild(script)
    })
  }
  return pickerLoadingPromise
}

// Botón "Adjuntar desde Drive", al lado del de adjuntar archivo local. En vez de descargar
// el archivo de Drive y adjuntarlo (chocaría con el límite de 25MB de Gmail igual que un
// adjunto local pesado), inserta un LINK al archivo — así es como Gmail resuelve archivos
// grandes vía Drive, y no tiene límite de tamaño real.
export default function DriveAttachButton({ onPicked }) {
  const { requestDriveAccessToken } = useGoogleOAuth()
  const [loading, setLoading] = useState(false)

  const openPicker = async () => {
    if (!GOOGLE_MAPS_API_KEY) {
      toast.error('Falta configurar VITE_GOOGLE_MAPS_API_KEY (se reusa como developer key del picker)')
      return
    }
    setLoading(true)
    try {
      await loadPickerLib()
      const accessToken = await requestDriveAccessToken()

      const view = new window.google.picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)

      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(GOOGLE_MAPS_API_KEY)
        .setCallback((data) => {
          if (data.action !== window.google.picker.Action.PICKED) return
          const doc = data.docs?.[0]
          if (!doc) return
          onPicked({
            name: doc.name,
            url: doc.url,
            mimeType: doc.mimeType,
            iconUrl: doc.iconUrl,
          })
        })
        .build()
      picker.setVisible(true)
    } catch (err) {
      console.error(err)
      if (err.message !== 'popup_closed') toast.error('No se pudo abrir Google Drive')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={loading}
      className="btn-ghost text-xs px-2 py-1.5 flex-shrink-0"
      title="Adjuntar desde Drive (se inserta como link, sin límite de tamaño)"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
      Desde Drive
    </button>
  )
}
