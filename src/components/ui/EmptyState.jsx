import { CheckSquare } from 'lucide-react'

export default function EmptyState({ icon: Icon = CheckSquare, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-brand-bg-2 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={26} className="text-brand-text-light" />
      </div>
      <p className="text-sm font-semibold text-brand-text mb-1">{title}</p>
      {description && <p className="text-xs text-brand-text-muted mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}
