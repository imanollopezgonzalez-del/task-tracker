import { useState, useEffect } from 'react'
import { Mail, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, XCircle, PenSquare } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { useGoogleOAuth } from '../../hooks/useGoogleOAuth'
import {
  subscribeConnectedAccounts, connectGmailAccount, disconnectGmailAccount, subscribeMailingLogs,
} from '../../services/mailing'
import ComposeEmailModal from '../../components/mailing/ComposeEmailModal'

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

function LogRow({ log }) {
  const date = log.createdAt?.toDate ? log.createdAt.toDate() : null
  const isSent = log.status === 'sent'
  return (
    <tr className="border-b border-brand-border last:border-0">
      <td className="px-3 py-2 text-xs text-brand-text-muted whitespace-nowrap">
        {date ? format(date, "d MMM yyyy, HH:mm", { locale: es }) : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-brand-text truncate max-w-[160px]">{log.fromEmail}</td>
      <td className="px-3 py-2 text-xs text-brand-text truncate max-w-[160px]">{log.to}</td>
      <td className="px-3 py-2 text-xs text-brand-text truncate max-w-[220px]">{log.subject}</td>
      <td className="px-3 py-2 text-xs">
        {isSent ? (
          <span className="badge bg-green-100 text-green-700"><CheckCircle2 size={11} /> Enviado</span>
        ) : (
          <span className="badge bg-red-100 text-red-700"><XCircle size={11} /> Error</span>
        )}
      </td>
    </tr>
  )
}

export default function Mailing() {
  const { userProfile } = useAuth()
  const companyId = userProfile?.companyId
  const { requestGmailAuthCode } = useGoogleOAuth()

  const [accounts, setAccounts] = useState([])
  const [logs, setLogs] = useState([])
  const [connecting, setConnecting] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeConnectedAccounts(companyId, setAccounts)
    return unsub
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    const unsub = subscribeMailingLogs(companyId, setLogs)
    return unsub
  }, [companyId])

  const sortedLogs = [...logs].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-brand-border bg-white flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-brand-text">Mailing</h1>
          <p className="text-xs text-brand-text-muted mt-0.5">Cuentas de Gmail conectadas e historial de envíos</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          disabled={accounts.length === 0}
          title={accounts.length === 0 ? 'Conectá una cuenta de Gmail primero' : ''}
          className="btn-primary text-xs px-3 py-1.5"
        >
          <PenSquare size={14} /> Nuevo email
        </button>
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
          <h2 className="text-sm font-semibold text-brand-text mb-3">Historial de envíos</h2>
          {sortedLogs.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-brand-text-muted">Todavía no se envió ningún email.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-bg">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Fecha</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">De</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Para</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Asunto</th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand-text-muted">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log) => <LogRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} />}
    </div>
  )
}
