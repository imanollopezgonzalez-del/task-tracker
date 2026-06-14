import { NavLink, useNavigate } from 'react-router-dom'
import { CheckSquare, BarChart3, Users, Settings, LogOut, Calendar, Menu, X, Mail, UserPlus, Contact, Briefcase, TrendingUp } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'
import Avatar from '../ui/Avatar'
import toast from 'react-hot-toast'

const MEMBER_NAV = [
  { to: '/tasks', icon: CheckSquare, label: 'Tareas', end: true },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
]

const ADMIN_NAV = [
  { to: '/tasks', icon: CheckSquare, label: 'Tareas', end: true },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/kpi', icon: BarChart3, label: 'KPIs & Métricas' },
  { to: '/admin', icon: Users, label: 'Equipo' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
]

// Sección CRM - solo para admin o usuarios con crmAccess
const CRM_NAV = [
  { to: '/crm/mailing', icon: Mail, label: 'Mailing', disabled: true },
  { to: '/crm/leads', icon: UserPlus, label: 'Leads' },
  { to: '/crm/contactos', icon: Contact, label: 'Contactos' },
  { to: '/crm/clientes', icon: Briefcase, label: 'Clientes', disabled: true },
  { to: '/crm/panel', icon: TrendingUp, label: 'Panel de ventas', disabled: true },
]

function SidebarContent({ onClose }) {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = userProfile?.role === 'admin'
  const hasCrm = isAdmin || userProfile?.crmAccess === true
  const navItems = isAdmin ? ADMIN_NAV : MEMBER_NAV

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  return (
    <div className="flex flex-col h-full bg-brand-dark">
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-bold leading-none">Gestión</p>
            <p className="text-white/50 text-xs leading-none mt-0.5 truncate">Pollo Cocido & Pariggi</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white lg:hidden p-1">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
            className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}>
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {hasCrm && (
          <>
            <div className="px-3 pt-3 pb-1">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">Clientes</p>
            </div>
            {CRM_NAV.map((item) =>
              item.disabled ? (
                <div
                  key={item.to}
                  className="sidebar-item sidebar-item-inactive opacity-40 cursor-not-allowed"
                  title="Próximamente"
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </div>
              ) : (
                <NavLink key={item.to} to={item.to} onClick={onClose}
                  className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              )
            )}
          </>
        )}
      </nav>

      <div className="px-2 pb-4 pt-2 border-t border-white/10 mt-2">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <Avatar name={userProfile?.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{userProfile?.displayName}</p>
            <p className="text-white/50 text-xs">{isAdmin ? 'Administrador' : 'Colaborador'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-item sidebar-item-inactive w-full">
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-brand-dark px-4 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={() => setMobileOpen(true)} className="text-white/80 hover:text-white">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-orange rounded-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-white text-sm font-semibold">Gestión de Tareas</span>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full shadow-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="hidden lg:flex w-56 flex-shrink-0 h-screen sticky top-0">
        <div className="w-full">
          <SidebarContent />
        </div>
      </div>
    </>
  )
}
