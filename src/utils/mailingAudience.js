import { getResponsables } from './crmHelpers'

const currentYear = new Date().getFullYear()

function getAnoAlta(c) {
  if (c.anoAlta) return c.anoAlta
  if (c.fechaCierre) return new Date(c.fechaCierre + 'T12:00:00').getFullYear()
  return currentYear
}

export const AUDIENCE_TYPES = [
  { key: 'leads', label: 'Leads' },
  { key: 'contactos', label: 'Contactos' },
  { key: 'clientes', label: 'Clientes' },
]

export const CLIENTE_SEGMENTOS = [
  { key: 'nuevos', label: 'Clientes nuevos' },
  { key: 'antiguos', label: 'Clientes antiguos' },
  { key: 'perdidos', label: 'Clientes perdidos' },
]

function baseByType(records, audienceType) {
  if (audienceType === 'leads') {
    return records.filter((l) => !(l.esCliente || (l.registroTipo && l.registroTipo !== 'lead')))
  }
  if (audienceType === 'contactos') {
    return records.filter((l) => l.registroTipo === 'contacto' || (l.esCliente === true && !l.registroTipo))
  }
  if (audienceType === 'clientes') {
    return records.filter((l) => l.registroTipo === 'cliente')
  }
  return []
}

function clienteSegmento(c) {
  if (c.clienteEstado === 'perdido') return 'perdidos'
  return getAnoAlta(c) < currentYear ? 'antiguos' : 'nuevos'
}

// Filtra la colección `leads` (sirve leads/contactos/clientes, diferenciados por registroTipo)
// con el mismo criterio de tipo/producto/responsable ya usado en Leads/Contactos/Clientes.
export function filterAudience(records, { audienceType, tipo, producto, responsable, segmentos }) {
  let result = baseByType(records, audienceType)
  if (audienceType === 'clientes' && segmentos?.length) {
    result = result.filter((c) => segmentos.includes(clienteSegmento(c)))
  }
  if (tipo) result = result.filter((r) => r.tipoCliente === tipo)
  if (producto) result = result.filter((r) => r.producto === producto)
  if (responsable) result = result.filter((r) => getResponsables(r).includes(responsable))
  return result
}

// Resuelve email/nombre/empresa de un registro (mismo fallback que las fichas de detalle).
// Devuelve null si no tiene ningún email cargado — ese registro se excluye del envío.
export function resolveRecipient(record) {
  const primerContacto = record.contactos?.[0]
  const email = primerContacto?.emails?.[0] || record.email || ''
  if (!email) return null
  const nombre = primerContacto?.nombre || record.personaContacto || ''
  return { email, nombre, empresa: record.nombre || '', leadId: record.id }
}
