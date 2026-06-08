import Sidebar from './Sidebar'
import { Toaster } from 'react-hot-toast'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-brand-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#1C1917', color: '#FAF8F5', borderRadius: '12px', fontSize: '13px' },
        success: { iconTheme: { primary: '#D97757', secondary: '#FAF8F5' } },
      }} />
    </div>
  )
}
