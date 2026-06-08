// Paleta de colores distintos garantizados — cada persona tiene el suyo
const PALETTE = [
  'bg-orange-500',  // 0
  'bg-blue-600',    // 1
  'bg-emerald-500', // 2
  'bg-violet-500',  // 3
  'bg-pink-500',    // 4
  'bg-amber-500',   // 5
  'bg-cyan-600',    // 6
  'bg-red-500',     // 7
  'bg-indigo-500',  // 8
  'bg-teal-500',    // 9
]

function hashName(name) {
  if (!name) return 0
  return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

export default function Avatar({ name, size = 'sm' }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const color = PALETTE[hashName(name) % PALETTE.length]
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none`}>
      {initials}
    </div>
  )
}
