import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { subscribeCampaignLogs } from '../../services/mailing'

function LogGroup({ title, logs, color }) {
  const [open, setOpen] = useState(false)
  if (logs.length === 0) return null
  return (
    <div className="border-b border-brand-border last:border-0">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-brand-bg-2">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-sm font-medium" style={{ color }}>{title}</span>
        <span className="text-xs text-brand-text-muted">/ {logs.length}</span>
      </button>
      {open && (
        <ul className="pb-2">
          {logs.map((log) => (
            <li key={log.id} className="px-10 py-1 text-xs text-brand-text-muted truncate">{log.to}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CampaignDetail({ campaign, onClose }) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const unsub = subscribeCampaignLogs(campaign.id, setLogs)
    return unsub
  }, [campaign.id])

  const sent = logs.filter((l) => l.status === 'sent')
  const failed = logs.filter((l) => l.status === 'error')
  const date = campaign.createdAt?.toDate ? campaign.createdAt.toDate() : null

  const pct = (n) => campaign.recipientCount ? Math.round((n / campaign.recipientCount) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text truncate pr-4">{campaign.subject}</h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-brand-border">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Destinatarios</p>
            <p className="text-lg font-bold text-brand-text">{campaign.recipientCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Entregado</p>
            <p className="text-lg font-bold text-green-600">{pct(campaign.sentCount)}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-brand-text-muted">Falló</p>
            <p className="text-lg font-bold text-red-600">{pct(campaign.failedCount)}%</p>
          </div>
        </div>

        <div className="px-6 py-3 text-xs text-brand-text-muted border-b border-brand-border space-y-1">
          <p>Enviado por <span className="font-medium text-brand-text">{campaign.sentByName}</span> desde {campaign.fromEmail}</p>
          {date && <p>{format(date, "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>}
        </div>

        <div className="overflow-y-auto flex-1">
          <LogGroup title="Se envió con éxito" logs={sent} color="#16A34A" />
          <LogGroup title="No se pudo enviar" logs={failed} color="#DC2626" />
        </div>
      </div>
    </div>
  )
}
