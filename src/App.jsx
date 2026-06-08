import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { TaskProvider } from './contexts/TaskContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import KPI from './pages/KPI'
import Admin from './pages/Admin'
import Settings from './pages/Settings'
import Spinner from './components/ui/Spinner'

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <Spinner size="lg" />
    </div>
  )
  if (!currentUser) return <Navigate to="/login" replace />
  return (
    <NotificationProvider>
      <TaskProvider>
        <Layout>{children}</Layout>
      </TaskProvider>
    </NotificationProvider>
  )
}

function AppRoutes() {
  const { currentUser } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/all-tasks" element={<ProtectedRoute><Tasks showAll /></ProtectedRoute>} />
      <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
      <Route path="/kpi" element={<ProtectedRoute><KPI /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
