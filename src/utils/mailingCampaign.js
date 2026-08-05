const STUCK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutos

// Si sendBulkMail muere a mitad del loop (p. ej. hard timeout de 540s en una campaña muy
// grande), finishCampaign nunca corre y la campaña queda en status: 'sending' para siempre.
// bumpCampaignCounter estampa updatedAt en cada envío como heartbeat: si no hubo actividad
// en los últimos 5 minutos y sigue "sending", la tratamos como interrumpida en el cliente
// (no hace falta una Cloud Function nueva, es una comparación de timestamps al renderizar).
export function isCampaignStuck(campaign) {
  if (!campaign || campaign.status !== 'sending') return false
  const lastActivity = campaign.updatedAt?.toMillis?.() ?? campaign.createdAt?.toMillis?.()
  if (!lastActivity) return false
  return Date.now() - lastActivity > STUCK_THRESHOLD_MS
}
