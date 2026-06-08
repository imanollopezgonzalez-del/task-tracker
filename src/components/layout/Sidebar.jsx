import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, BarChart3, Users, Settings, LogOut, CheckSquare2, Menu, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'
import Avatar from '../ui/Avatar'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio', end: true },
  { to: '/tasks', icon: CheckSquare, label: 'Mis Tareas' },
  { to: '/all-tasks', icon: CheckSquare2, label: 'Todas las Tareas', adminOnly: false },
  { to: '/kpi', icon: BarChart3, label: 'KPIs & Métricas' },
  { to: '/admin', icon: Users, label: 'Equipo', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
]

function SidebarContent({ onClose }) {
  const { userProfile, logout } = useAuth()
  const navigate = useNavigate()

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
            <CheckSquare size={16} className="text-white" />
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
        {NAV_ITEMS.filter((item) => !item.adminOnly || userProfile?.role === 'admin').map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            onClick={onClose}
            className={({ isActive }) => `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}>
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pb-4 pt-2 border-t border-white/10 mt-2">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <Avatar name={userProfile?.displayName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{userProfile?.displayName}</p>
            <p className="text-white/50 text-xs truncate">{userProfile?.role === 'admin' ? 'Administrador' : 'Empleado'}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="sidebar-item sidebar-item-inactive w-full">
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
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-brand-dark px-4 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={() => setMobileOpen(true)} className="text-white/80 hover:text-white">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-orange rounded-md flex items-center justify-center">
            <CheckSquare size={14} className="text-white" />
          </div>
          <span className="text-white text-sm font-semibold">Gestión de Tareas</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full shadow-xl">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 flex-shrink-0 h-screen sticky top-0">
        <div className="w-full">
          <SidebarContent />
        </div>
      </div>
    </>
  )
}
