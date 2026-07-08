// Un lead/contacto/cliente puede tener 0+ responsables. Los registros viejos
// todavía tienen el campo singular `responsable` en vez del nuevo `responsables`.
export function getResponsables(record) {
  if (Array.isArray(record?.responsables) && record.responsables.length) return record.responsables
  if (record?.responsable) return [record.responsable]
  return []
}

// Campos obligatorios antes de poder marcar un Contacto como "Ganado" (→ Cliente)
export function getCamposFaltantesParaGanado(record) {
  const faltantes = []
  if (!record.kilosMensuales) faltantes.push('Kilos mensuales estimados')
  if (!record.tipoCliente) faltantes.push('Tipo de cliente')
  if (!record.listaPrecios) faltantes.push('Lista de precios')
  if (getResponsables(record).length === 0) faltantes.push('Responsable')
  const tieneContacto = record.contactos?.some((c) => c.nombre?.trim()) || record.personaContacto?.trim()
  if (!tieneContacto) faltantes.push('Persona de contacto')
  return faltantes
}
