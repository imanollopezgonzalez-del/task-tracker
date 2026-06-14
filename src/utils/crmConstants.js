// Pipeline stages - orden del proceso de contacto
export const LEAD_STAGES = {
  lead_nuevo: { label: 'Lead nuevo', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', order: 1 },
  email: { label: 'Email', color: 'bg-blue-50 text-blue-600 border-blue-200', dot: 'bg-blue-500', order: 2 },
  instagram: { label: 'Instagram', color: 'bg-pink-50 text-pink-600 border-pink-200', dot: 'bg-pink-500', order: 3 },
  linkedin: { label: 'LinkedIn', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-600', order: 4 },
  whatsapp: { label: 'WhatsApp', color: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500', order: 5 },
  llamada: { label: 'Llamada', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', order: 6 },
  no_contactado: { label: 'No contactado', color: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400', order: 7 },
  reintentar_contacto: { label: 'Reintentar contacto', color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-400', order: 8 },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400', order: 9 },
}

// Etapas del pipeline (barra de progreso)
export const PIPELINE_STEPS = ['lead_nuevo', 'email', 'instagram', 'linkedin', 'whatsapp', 'llamada']

export const TIPOS_CLIENTE = [
  'Distribuidor',
  'Catering',
  'Comercio / Restaurante',
  'Cliente Boutique',
  'Mayorista',
]

export const PRODUCTOS = [
  'Pastas Pariggi',
  'Pollo Cocido',
]

export const PUESTOS = [
  'Contacto de empresa',
  'Dueño',
  'Gerente de ventas',
  'Encargado de compras',
  'Chef',
  'Presidente',
  'Gerente Calidad',
]

// Orígenes = grupos reales del lead. El grupo se setea automáticamente desde el origen.
export const ORIGENES_CONTACTO = [
  { key: 'Google Researching', label: 'Google Researching', color: '#4285F4' },
  { key: 'Google Ads', label: 'Google Ads', color: '#34A853' },
  { key: 'LinkedIn Researching', label: 'LinkedIn Researching', color: '#0A66C2' },
  { key: 'LinkedIn Ads', label: 'LinkedIn Ads', color: '#0A66C2' },
  { key: 'Email Marketing', label: 'Email Marketing', color: '#8B5CF6' },
  { key: 'Contactos Lucho', label: 'Contactos Lucho', color: '#F59E0B' },
  { key: 'Instagram', label: 'Instagram', color: '#E1306C' },
]

// Grupos en la lista: orígenes + grupos especiales basados en estado
export const GRUPOS_LISTA = [
  ...ORIGENES_CONTACTO,
  { key: 'No contactados', label: 'No contactados', color: '#EF4444', virtual: true },
  { key: 'Clientes a Recuperar', label: 'Clientes a Recuperar', color: '#D97757', virtual: true },
]

// Compat alias para imports existentes
export const GRUPOS_LEADS = GRUPOS_LISTA

export const RESPONSABLES = [
  'Imanol Lopez Fuente',
  'Ivan Federico Larez',
  'LUCIANO',
]

// ── Contactos (proceso de ventas) ───────────────────────────────────────────
export const CONTACTO_STAGES = {
  contactado:        { label: 'Contactado',                   color: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400',   kanban: '#94A3B8', order: 1 },
  envio_info:        { label: 'Envío información comercial',  color: 'bg-blue-50 text-blue-600 border-blue-200',      dot: 'bg-blue-400',   kanban: '#60A5FA', order: 2 },
  respuesta_cliente: { label: 'Respuesta cliente',            color: 'bg-purple-50 text-purple-600 border-purple-200',dot: 'bg-purple-400', kanban: '#A78BFA', order: 3 },
  llamada:           { label: 'Llamada (Solicitud de datos)', color: 'bg-slate-100 text-slate-700 border-slate-200',  dot: 'bg-slate-600',  kanban: '#475569', order: 4 },
  envio_muestras:    { label: 'Envío muestras / Demo',        color: 'bg-sky-50 text-sky-700 border-sky-200',         dot: 'bg-sky-600',    kanban: '#0369A1', order: 5 },
  seguimiento:       { label: 'Seguimiento muestras',         color: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-teal-500',   kanban: '#0D9488', order: 6 },
  cierre:            { label: 'Cierre',                       color: 'bg-gray-100 text-gray-500 border-gray-200',     dot: 'bg-gray-500',   kanban: '#6B7280', order: 7 },
  ganado:            { label: 'Ganado',                       color: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500',  kanban: '#16A34A', order: 8 },
  perdido:           { label: 'Perdido',                      color: 'bg-red-50 text-red-600 border-red-200',         dot: 'bg-red-400',    kanban: '#DC2626', order: 9 },
}

export const CONTACTO_PIPELINE = [
  'contactado', 'envio_info', 'respuesta_cliente', 'llamada', 'envio_muestras', 'seguimiento', 'cierre',
]

export const TIPO_CLIENTE_COLORS = {
  'Distribuidor':           '#3B82F6',
  'Catering':               '#F97316',
  'Comercio / Restaurante': '#EF4444',
  'Cliente Boutique':       '#8B5CF6',
  'Mayorista':              '#22C55E',
  'Cliente Final':          '#9CA3AF',
}

export const NOTE_TYPES = {
  nota: { label: 'Nota', color: 'bg-brand-bg-2 border-brand-border' },
  importante: { label: 'Importante', color: 'bg-orange-50 border-orange-200' },
}
