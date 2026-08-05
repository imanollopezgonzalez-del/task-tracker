import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJsApiLoader, GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeLeads } from '../../services/leads'
import { TIPO_CLIENTE_COLORS } from '../../utils/crmConstants'
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../../config/googleMaps'
import Header from '../../components/layout/Header'
import { MapPin } from 'lucide-react'

const CENTER_ARGENTINA = { lat: -34.6, lng: -58.45 }
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' }

export default function MapaClientes() {
  const { userProfile } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [activeId, setActiveId] = useState(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  useEffect(() => {
    if (!userProfile?.companyId) return
    return subscribeLeads(userProfile.companyId, setLeads)
  }, [userProfile?.companyId])

  const clientesConUbicacion = useMemo(() => (
    leads.filter((l) => l.registroTipo === 'cliente' && l.clienteEstado !== 'perdido'
      && typeof l.ubicacionLat === 'number' && typeof l.ubicacionLng === 'number')
  ), [leads])

  const activeCliente = clientesConUbicacion.find((c) => c.id === activeId)

  return (
    <div className="flex flex-col h-full">
      <Header title="Mapa de clientes" />
      <div className="flex-1 relative">
        {!GOOGLE_MAPS_API_KEY ? (
          <div className="h-full flex items-center justify-center text-sm text-brand-text-muted p-6 text-center">
            Falta configurar VITE_GOOGLE_MAPS_API_KEY para mostrar el mapa.
          </div>
        ) : !isLoaded ? (
          <div className="h-full flex items-center justify-center text-sm text-brand-text-muted">Cargando mapa...</div>
        ) : (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER_STYLE}
            center={CENTER_ARGENTINA}
            zoom={5}
            options={{ streetViewControl: false, mapTypeControl: false }}
          >
            {clientesConUbicacion.map((c) => (
              <MarkerF
                key={c.id}
                position={{ lat: c.ubicacionLat, lng: c.ubicacionLng }}
                onClick={() => setActiveId(c.id)}
              />
            ))}
            {activeCliente && (
              <InfoWindowF
                position={{ lat: activeCliente.ubicacionLat, lng: activeCliente.ubicacionLng }}
                onCloseClick={() => setActiveId(null)}
              >
                <div className="text-sm">
                  <p className="font-semibold text-brand-text mb-0.5">{activeCliente.nombre}</p>
                  {activeCliente.tipoCliente && (
                    <span
                      className="inline-block text-xs px-2 py-0.5 rounded-full text-white font-medium mb-1"
                      style={{ backgroundColor: TIPO_CLIENTE_COLORS[activeCliente.tipoCliente] || '#94A3B8' }}
                    >
                      {activeCliente.tipoCliente}
                    </span>
                  )}
                  <p className="text-brand-text-muted flex items-center gap-1 mb-2">
                    <MapPin size={11} /> {activeCliente.ubicacion}
                  </p>
                  <button
                    onClick={() => navigate(`/crm/clientes/${activeCliente.id}`)}
                    className="text-xs text-brand-orange hover:underline font-medium"
                  >
                    Ver ficha →
                  </button>
                </div>
              </InfoWindowF>
            )}
          </GoogleMap>
        )}
        {isLoaded && clientesConUbicacion.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white shadow-card border border-brand-border rounded-lg px-4 py-2 text-xs text-brand-text-muted">
            Ningún cliente tiene ubicación cargada todavía. Cargala desde la ficha (autocompletado de dirección).
          </div>
        )}
      </div>
    </div>
  )
}
