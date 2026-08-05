import { useRef, useState } from 'react'
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api'
import { MapPin } from 'lucide-react'
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '../../config/googleMaps'

// Autocompletado de dirección con Google Places. value/onChange se comportan como un
// input de texto normal (string) para no romper leads viejos con ubicación libre; además
// onPlaceSelected(lat, lng) se dispara solo cuando el usuario elige una sugerencia real,
// para poder guardar coordenadas y mostrar el cliente en el mapa.
export default function AddressAutocomplete({ value, onChange, onPlaceSelected, placeholder }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })
  const [autocomplete, setAutocomplete] = useState(null)

  const handlePlaceChanged = () => {
    const place = autocomplete?.getPlace()
    if (!place?.geometry) return
    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    onChange(place.formatted_address || value)
    onPlaceSelected?.(lat, lng)
  }

  if (!GOOGLE_MAPS_API_KEY || !isLoaded) {
    return (
      <input
        className="input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  return (
    <div className="relative">
      <Autocomplete
        onLoad={setAutocomplete}
        onPlaceChanged={handlePlaceChanged}
        options={{ componentRestrictions: { country: 'ar' }, fields: ['formatted_address', 'geometry'] }}
      >
        <input
          className="input-field pl-9"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </Autocomplete>
      <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-light pointer-events-none" />
    </div>
  )
}
