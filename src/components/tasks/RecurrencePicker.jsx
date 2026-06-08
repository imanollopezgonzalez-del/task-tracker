import { ChevronDown } from 'lucide-react'

const DAYS_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAYS_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function RecurrencePicker({ recurrence, config, onChange, onConfigChange }) {
  const cfg = config || {}

  const toggleDay = (day) => {
    const days = cfg.days || [1, 2, 3, 4, 5]
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
    if (next.length === 0) return
    onConfigChange({ ...cfg, days: next })
  }

  return (
    <div className="space-y-3">
      {/* Tipo de recurrencia */}
      <div>
        <label className="label">Repetición</label>
        <div className="relative">
          <select className="select-field pr-8" value={recurrence} onChange={(e) => onChange(e.target.value)}>
            <option value="daily">Diaria</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Diaria: cada N días */}
      {recurrence === 'daily' && (
        <div className="flex items-center gap-2 bg-brand-bg-2 rounded-lg px-3 py-2">
          <span className="text-xs text-brand-text-muted">Cada</span>
          <input type="number" min={1} max={30}
            className="w-14 px-2 py-1 border border-brand-border rounded-md text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
            value={cfg.every || 1}
            onChange={(e) => onConfigChange({ ...cfg, every: Math.max(1, parseInt(e.target.value) || 1) })} />
          <span className="text-xs text-brand-text-muted">{(cfg.every || 1) === 1 ? 'día' : 'días'}</span>
        </div>
      )}

      {/* Semanal: elegir días de la semana */}
      {recurrence === 'weekly' && (
        <div>
          <label className="label">Los días</label>
          <div className="flex gap-1.5">
            {DAYS_SHORT.map((d, i) => {
              const selected = (cfg.days || [1, 2, 3, 4, 5]).includes(i)
              return (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-9 h-9 rounded-full text-xs font-bold transition-colors ${selected ? 'bg-brand-orange text-white' : 'bg-brand-bg-2 text-brand-text-muted border border-brand-border hover:border-brand-orange hover:text-brand-orange'}`}>
                  {d}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-brand-text-light mt-1">
            {(cfg.days || [1,2,3,4,5]).map((d) => DAYS_LABEL[d]).join(', ')}
          </p>
        </div>
      )}

      {/* Mensual: elegir día del mes */}
      {recurrence === 'monthly' && (
        <div className="flex items-center gap-2 bg-brand-bg-2 rounded-lg px-3 py-2">
          <span className="text-xs text-brand-text-muted">El día</span>
          <input type="number" min={1} max={31}
            className="w-14 px-2 py-1 border border-brand-border rounded-md text-sm text-center bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
            value={cfg.dayOfMonth || new Date().getDate()}
            onChange={(e) => onConfigChange({ ...cfg, dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} />
          <span className="text-xs text-brand-text-muted">de cada mes</span>
        </div>
      )}

      {/* Anual: sin config extra */}
      {recurrence === 'annual' && (
        <div className="bg-brand-bg-2 rounded-lg px-3 py-2">
          <p className="text-xs text-brand-text-muted">Se repite una vez al año en la fecha límite indicada.</p>
        </div>
      )}
    </div>
  )
}
