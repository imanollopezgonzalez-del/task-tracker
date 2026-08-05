import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, PenSquare, Pencil, FileType, Megaphone } from 'lucide-react'
import { isCampaignStuck } from '../../utils/mailingCampaign'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useGoogleOAuth } from '../../hooks/useGoogleOAuth'
import {
  subscribeConnectedAccounts, connectGmailAccount, disconnectGmailAccount,
  subscribeMailTemplates, deleteMailTemplate, subscribeMailCampaigns,
} from '../../services/mailing'
import ComposeEmailModal from '../../components/mailing/ComposeEmailModal'
import TemplateModal from '../../components/mailing/TemplateModal'
import BulkSendPanel from '../../components/mailing/BulkSendPanel'
import CampaignDetail from '../../components/mailing/CampaignDetail'

function AccountRow({ account, onDisconnect }) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    if (!window.confirm(`¿Desconectar ${account.email}?`)) return
    setDisconnecting(true)
    try {
      await onDisconnect(account.id)
      toast.success('Cuenta desconectada')
    } catch (err) {
      toast.error(err.message || 'Error al desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-brand-border rounded-xl bg-white">
      <div className="w-9 h-9 rounded-full bg-brand-orange-light flex items-center justify-center flex-shrink-0">
        <Mail size={16} className="text-brand-orange-dark" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-text truncate">{account.email}</p>
        <p className="text-xs text-brand-text-muted">Conectada por {account.connectedBy || '—'}</p>
      </div>
      {account.status === 'reauth_required' && (
        <span className="badge bg-amber-100 text-amber-700 flex-shrink-0">
          <AlertTriangle size={11} /> Reconectar
        </span>
      )}
      <button
        onClick={handleDisconnect}
        disabled={disconnecting}
        className="btn-ghost text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 flex-shrink-0"
      >
        {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Desconectar
      </button>
    </div>
  )
}

export default function Mailing() {
  const { userProfile } = useAuth()
  const companyId = userProfile?.companyId
  const { requestGmailAuthCode } = useGoogleOAuth()

  const [accounts, setAccounts] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showBulkSend, setShowBulkSend] = useState(false)
  const [templates, setTemplates] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeConnectedAccounts(companyId, setAccounts)
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailCampaigns(companyId, setCampaigns)
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailTemplates(companyId, setTemplates)
    return unsub
  }, [companyId])

  const sortedCampaigns = [...campaigns].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const authCode = await requestGmailAuthCode()
      await connectGmailAccount(authCode)
      toast.success('Cuenta de Gmail conectada')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Error al conectar la cuenta')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (accountId) => {
    await disconnectGmailAccount(accountId)
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    try {
      await deleteMailTemplate(templateId)
      toast.success('Plantilla eliminada')
    } catch (err) {
      toast.error('Error al eliminar la plantilla')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-brand-border bg-white flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-brand-text">Mailing</h1>
          <p className="text-xs text-brand-text-muted mt-0.5">Cuentas de Gmail conectadas e historial de envíos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkSend(true)}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Conectá una cuenta de Gmail primero' : ''}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Megaphone size={14} /> Envío masivo
          </button>
          <button
            onClick={() => setShowCompose(true)}
            disabled={accounts.length === 0}
            title={accounts.length === 0 ? 'Conectá una cuenta de Gmail primero' : ''}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <PenSquare size={14} /> Nuevo email
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-text">Cuentas conectadas</h2>
            <button onClick={handleConnect} disabled={connecting} className="btn-primary text-xs px-3 py-1.5">
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Conectar cuenta de Gmail
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no hay ninguna cuenta de Gmail conectada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <AccountRow key={a.id} account={a} onDisconnect={handleDisconnect} />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-text">Plantillas</h2>
            <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true) }} className="btn-primary text-xs px-3 py-1.5">
              <FileType size={14} /> Nueva plantilla
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no creaste ninguna plantilla.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 border border-brand-border rounded-xl bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-text truncate">{t.name}</p>
                    <p className="text-xs text-brand-text-muted truncate">{t.subject}</p>
                  </div>
                  <span className="badge bg-brand-bg-2 text-brand-text-muted flex-shrink-0">
                    {t.mode === 'html' ? 'HTML' : 'Visual'}
                  </span>
                  <button onClick={() => { setEditingTemplate(t); setShowTemplateModal(true) }} className="btn-ghost text-xs px-2 py-1.5 flex-shrink-0">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => handleDeleteTemplate(t.id)} className="btn-ghost text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 flex-shrink-0">
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-brand-text mb-3">Historial de envíos</h2>
          {sortedCampaigns.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no se envió ningún email.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-bg">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Fecha</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Asunto</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Destinatarios</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Entregado</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Abierto</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Click</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Falló</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.map((c) => {
                    const date = c.createdAt?.toDate ? c.createdAt.toDate() : null
                    const pct = (n) => c.recipientCount ? Math.round((n / c.recipientCount) * 100) : 0
                    // Abierto/Click son % sobre lo que efectivamente se entregó, no sobre el total
                    // de destinatarios (que incluye fallos que nunca pudieron abrirse).
                    const pctOfSent = (n) => c.sentCount ? Math.round((n / c.sentCount) * 100) : 0
                    return (
                      <tr key={c.id} onClick={() => setSelectedCampaign(c)} className="border-b border-brand-border last:border-0 hover:bg-brand-bg-2 cursor-pointer">
                        <td className="px-3 py-2 text-xs text-brand-text-muted whitespace-nowrap">
                          {date ? format(date, "d MMM yyyy, HH:mm", { locale: es }) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-brand-text truncate max-w-[220px]">{c.subject}</td>
                        <td className="px-3 py-2 text-xs text-brand-text-muted">{c.recipientCount}</td>
                        <td className="px-3 py-2 text-xs text-green-700 font-medium">{pct(c.sentCount)}%</td>
                        <td className="px-3 py-2 text-xs text-blue-600 font-medium">{pctOfSent(c.openedCount || 0)}%</td>
                        <td className="px-3 py-2 text-xs text-purple-600 font-medium">{pctOfSent(c.clickedCount || 0)}%</td>
                        <td className="px-3 py-2 text-xs text-red-600 font-medium">{pct(c.failedCount)}%</td>
                        <td className="px-3 py-2 text-xs">
                          {c.status === 'done' ? (
                            <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> Enviado</span>
                          ) : isCampaignStuck(c) ? (
                            <span className="badge bg-red-100 text-red-700"><AlertTriangle size={11} /> Interrumpido</span>
                          ) : (
                            <span className="badge bg-amber-100 text-amber-700">Enviando...</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => { setShowTemplateModal(false); setEditingTemplate(null) }}
        />
      )}

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} />}

      {showBulkSend && <BulkSendPanel onClose={() => setShowBulkSend(false)} />}

      {selectedCampaign && <CampaignDetail campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />}
    </div>
  )
}
