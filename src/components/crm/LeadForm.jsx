import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createLead, updateLead } from '../../services/leads'
import {
  LEAD_STAGES, TIPOS_CLIENTE, PRODUCTOS, PUESTOS,
  ORIGENES_CONTACTO, RESPONSABLES,
} from '../../utils/crmConstants'
import toast from 'react-hot-toast'

const EMPTY = {
  nombre: '',
  estado: 'lead_nuevo',
  contactado: false,
  tipoCliente: '',
  producto: '',
  personaContacto: '',
  puesto: '',
  telefono: '',
  email: '',
  ubicacion: '',
  responsable: '',
  origenContacto: '',
  observaciones: '',
}

export default function LeadForm({ lead, companyId, onClose }) {
  const { currentUser } = useAuth()
  const isEdit = !!lead
  const [form, setForm] = useState(
    isEdit
      ? {
          nombre: lead.nombre || '',
          estado: lead.estado || 'lead_nuevo',
          contactado: lead.contactado || false,
          tipoCliente: lead.tipoCliente || '',
          producto: lead.producto || '',
          personaContacto: lead.personaContacto || '',
          puesto: lead.puesto || '',
          telefono: lead.telefono || '',
          email: lead.email || '',
          ubicacion: lead.ubicacion || '',
          responsable: lead.responsable || '',
          origenContacto: lead.origenContacto || '',
          observaciones: lead.observaciones || '',
        }
      : { ...EMPTY }
  )
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setSaving(true)
    try {
      // grupo = origen del contacto (son lo mismo)
      const payload = { ...form, companyId, grupo: form.origenContacto }
      if (isEdit) {
        await updateLead(lead.id, payload)
        toast.success('Lead actualizado')
      } else {
        await createLead(payload, currentUser.uid)
        toast.success('Lead creado')
      }
      onClose()
    } catch (err) {
      toast.error('Error al guardar')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 className="text-base font-semibold text-brand-text">
            {isEdit ? 'Editar lead' : 'Agregar lead'}
          </h2>
          <button type="button" onClick={onClose} className="text-brand-text-muted hover:text-brand-text p-1 rounded-lg hover:bg-brand-bg-2">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {/* Nombre */}
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input-field"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              placeholder="Nombre de la empresa o persona"
            />
          </div>

          {/* Estado + Producto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Estado</label>
              <select className="select-field" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                {Object.entries(LEAD_STAGES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Producto</label>
              <select className="select-field" value={form.producto} onChange={(e) => set('producto', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {PRODUCTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Tipo de cliente + Origen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo de cliente</label>
              <select className="select-field" value={form.tipoCliente} onChange={(e) => set('tipoCliente', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Origen del contacto</label>
              <select className="select-field" value={form.origenContacto} onChange={(e) => set('origenContacto', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {ORIGENES_CONTACTO.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Persona de contacto + Puesto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Persona de contacto</label>
              <input
                className="input-field"
                value={form.personaContacto}
                onChange={(e) => set('personaContacto', e.target.value)}
                placeholder="Nombre del contacto"
              />
            </div>
            <div>
              <label className="label">Puesto</label>
              <select className="select-field" value={form.puesto} onChange={(e) => set('puesto', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {PUESTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Teléfono + Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Teléfono</label>
              <input
                className="input-field"
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value)}
                placeholder="+54 11 ..."
              />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input
                className="input-field"
                type="text"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="contacto@empresa.com"
              />
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="label">Ubicación</label>
            <input
              className="input-field"
              value={form.ubicacion}
              onChange={(e) => set('ubicacion', e.target.value)}
              placeholder="Ciudad, Provincia, Argentina"
            />
          </div>

          {/* Responsable */}
          <div>
            <label className="label">Responsable</label>
            <select className="select-field" value={form.responsable} onChange={(e) => set('responsable', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {RESPONSABLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Observaciones */}
          <div>
            <label className="label">Observaciones</label>
            <textarea
              className="textarea-field"
              rows={4}
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
              placeholder={"Añadí notas iniciales sobre este lead...\n(Enter para nueva línea)"}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-brand-border flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="button" onClick={handleGuardar} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
