import { PRIORITIES, STATUSES, SORT_OPTIONS } from '../../utils/constants'
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export default function TaskFilters({ filters, onChange }) {
  const [showFilters, setShowFilters] = useState(false)

  const set = (k, v) => onChange({ ...filters, [k]: v })
  const clearAll = () => onChange({ search: '', priority: '', status: '', sort: 'priority', view: filters.view })

  const activeCount = [filters.priority, filters.status].filter(Boolean).length

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <input type="text" className="input-field pl-9" placeholder="Buscar tarea..."
            value={filters.search} onChange={(e) => set('search', e.target.value)} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary relative px-3 ${activeCount > 0 ? 'border-brand-orange text-brand-orange' : ''}`}>
          <SlidersHorizontal size={15} />
          <span className="hidden sm:inline text-xs">Filtros</span>
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-orange text-white text-xs rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        <div className="relative">
          <select className="select-field pr-8 text-xs min-w-28" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
        </div>
      </div>

      {showFilters && (
        <div className="card p-3 flex flex-wrap gap-3 animate-fade-in">
          <div className="flex-1 min-w-32">
            <label className="label">Urgencia</label>
            <div className="relative">
              <select className="select-field pr-8 text-xs" value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-32">
            <label className="label">Estado</label>
            <div className="relative">
              <select className="select-field pr-8 text-xs" value={filters.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">Todos</option>
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
            </div>
          </div>
          {activeCount > 0 && (
            <div className="flex items-end">
              <button onClick={clearAll} className="btn-ghost text-xs py-2 gap-1">
                <X size={12} /> Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
