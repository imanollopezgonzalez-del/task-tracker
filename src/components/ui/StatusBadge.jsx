import { STATUSES } from '../../utils/constants'

export default function StatusBadge({ status, size = 'sm' }) {
  const s = STATUSES[status]
  if (!s) return null
  return (
    <span className={`badge ${s.bg} ${s.color} ${size === 'xs' ? 'text-xs px-1.5 py-0' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
