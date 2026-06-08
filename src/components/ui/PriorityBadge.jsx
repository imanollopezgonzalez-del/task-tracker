import { PRIORITIES } from '../../utils/constants'

export default function PriorityBadge({ priority, size = 'sm' }) {
  const p = PRIORITIES[priority]
  if (!p) return null
  return (
    <span className={`badge ${p.bg} ${p.color} border ${p.border} ${size === 'xs' ? 'text-xs px-1.5 py-0' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  )
}
