import { useState } from 'react'
import Modal from '../ui/Modal'

export default function SeguimientoModal({ isOpen, onClose, onConfirm, clienteNombre, saving }) {
  const [actualizado, setActualizado] = useState(null)
  const [comentario, setComentario] = useState('')

  const isValid = actualizado !== null && comentario.trim().length > 0

  const handleClose = () => {
    if (saving) return
    setActualizado(null)
    setComentario('')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid || saving) return
    onConfirm({ actualizado, comentario: comentario.trim() })
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar seguimiento" size="sm">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-sm text-brand-text-muted">
          Antes de completar el seguimiento de <span className="font-medium text-brand-text">{clienteNombre}</span>, contá qué pasó.
          Esto es obligatorio y queda registrado en la ficha del cliente.
        </p>

        <div>
          <p className="text-xs font-medium text-brand-text mb-1.5">¿Se pudo actualizar al cliente?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActualizado(true)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                actualizado === true
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'border-brand-border text-brand-text-muted hover:bg-brand-bg-2'
              }`}
            >
              Sí, se actualizó
            </button>
            <button
              type="button"
              onClick={() => setActualizado(false)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                actualizado === false
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'border-brand-border text-brand-text-muted hover:bg-brand-bg-2'
              }`}
            >
              No se pudo contactar
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-brand-text mb-1.5 block">Comentario</label>
          <textarea
            className="w-full text-sm border border-brand-border rounded-lg px-3 py-2 outline-none focus:border-brand-orange bg-white resize-none"
            rows={3}
            placeholder="¿Qué se habló? ¿Cómo sigue?"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2 text-sm font-medium text-brand-text-muted border border-brand-border rounded-lg hover:bg-brand-bg-2 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!isValid || saving}
            className="flex-1 py-2 text-sm font-medium text-white bg-brand-orange rounded-lg hover:bg-brand-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
