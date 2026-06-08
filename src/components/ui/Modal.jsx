import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white rounded-t-2xl sm:rounded-2xl shadow-modal animate-slide-up max-h-[95vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border flex-shrink-0">
          <h2 className="text-base font-semibold text-brand-text">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-brand-text-muted hover:bg-brand-bg-2 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
