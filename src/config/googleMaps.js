export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Referencia estable: useLoadScript/useJsApiLoader recargan el script si el array
// de libraries cambia de identidad entre renders.
export const GOOGLE_MAPS_LIBRARIES = ['places']
