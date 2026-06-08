import { Bell, Plus } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'
import { useState, useRef, useEffect } from 'react'
import { formatDateTime } from '../../utils/dates'
import { Link } from 'react-router-dom'

function NotificationDropdown({ notifications, unreadCount, read, readAll, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-brand-border shadow-modal z-50 animate-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <span className="text-sm font-semibold">Notificaciones {unreadCount > 0 && <span className="text-brand-orange">({unreadCount})</span>}</span>
        {unreadCount > 0 && (
          <button onClick={readAll} className="text-xs text-brand-orange hover:text-brand-orange-dark font-medium">Marcar todo leído</button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-brand-border">
        {notifications.length === 0 ? (
          <p className="text-center text-sm text-brand-text-muted py-8">Sin notificaciones</p>
        ) : notifications.slice(0, 20).map((n) => (
          <div key={n.id} onClick={() => read(n.id)}
            className={`px-4 py-3 cursor-pointer transition-colors hover:bg-brand-bg ${n.read ? 'opacity-60' : 'bg-brand-orange-light/30'}`}>
            {!n.read && <span className="w-2 h-2 bg-brand-orange rounded-full inline-block mr-2 align-middle" />}
            <p className="text-xs font-medium text-brand-text inline">{n.message}</p>
            <p className="text-xs text-brand-text-muted mt-0.5">{n.taskTitle} · {formatDateTime(n.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Header({ title, action }) {
  const { notifications, unreadCount, read, readAll } = useNotifications()
  const [showNotifs, setShowNotifs] = useState(false)

  return (
    <header className="sticky top-0 lg:top-0 z-20 bg-brand-bg/80 backdrop-blur-sm border-b border-brand-border px-4 lg:px-6 py-3 flex items-center justify-between mt-12 lg:mt-0">
      <h1 className="text-lg font-bold text-brand-text">{title}</h1>
      <div className="flex items-center gap-2">
        {action && (
          <button onClick={action.onClick} className="btn-primary text-xs px-3 py-1.5">
            <Plus size={15} />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        )}
        <div className="relative">
          <button onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg text-brand-text-muted hover:bg-brand-bg-2 transition-colors">
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-orange text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <NotificationDropdown notifications={notifications} unreadCount={unreadCount}
              read={read} readAll={readAll} onClose={() => setShowNotifs(false)} />
          )}
        </div>
      </div>
    </header>
  )
}
