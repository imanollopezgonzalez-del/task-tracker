import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { createLead, updateLead, addNota } from '../../services/leads'
import {
  LEAD_STAGES, TIPOS_CLIENTE, PRODUCTOS, PUESTOS,
  ORIGENES_CONTACTO, RESPONSABLES,
} from '../../utils/crmConstants'
import toast from 'react-hot-toast'

const EMPTY_CONTACTO = { nombre: '', puesto: '', telefono: '', emails: [''] }

const EMPTY = {
  nombre: '',
  estado: 'lead_nuevo',
  contactado: false,
  esCliente: false,
  tipoCliente: '',
  producto: '',
  contactos: [{ ...EMPTY_CONTACTO }],
  ubicacion: '',
  responsable: '',
  origenContacto: '',
  observaciones: '',
  kilosMensuales: '',
  fechaCierre: '',
}

export default function LeadForm({ lead, companyId, onClose, showContactoFields = false }) {
  const { currentUser } = useAuth()
  const isEdit = !!lead
  const [form, setForm] = useState(
    isEdit
      ? {
          nombre: lead.nombre || '',
          estado: lead.estado || 'lead_nuevo',
          contactado: lead.contactado || false,
          esCliente: lead.esCliente || false,
          tipoCliente: lead.tipoCliente || '',
          producto: lead.producto || '',
          contactos: lead.contactos?.length > 0
            ? lead.contactos
            : [{
                nombre: lead.personaContacto || '',
                puesto: lead.puesto || '',
                telefono: lead.telefono || '',
                emails: lead.email ? [lead.email] : [''],
              }],
          ubicacion: lead.ubicacion || '',
          responsable: lead.responsable || '',
          origenContacto: lead.origenContacto || '',
          observaciones: lead.observaciones || '',
          kilosMensuales: lead.kilosMensuales || '',
          fechaCierre: lead.fechaCierre || '',
        }
      : { ...EMPTY }
  )
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const addContacto = () => setForm((f) => ({
    ...f, contactos: [...f.contactos, { ...EMPTY_CONTACTO, emails: [''] }],
  }))
  const removeContacto = (ci) => setForm((f) => ({
    ...f, contactos: f.contactos.filter((_, i) => i !== ci),
  }))
  const setContacto = (ci, key, val) => setForm((f) => ({
    ...f, contactos: f.contactos.map((c, i) => i === ci ? { ...c, [key]: val } : c),
  }))
  const addEmail = (ci) => setForm((f) => ({
    ...f, contactos: f.contactos.map((c, i) =>
      i === ci && c.emails.length < 5 ? { ...c, emails: [...c.emails, ''] } : c
    ),
  }))
  const removeEmail = (ci, ei) => setForm((f) => ({
    ...f, contactos: f.contactos.map((c, i) =>
      i === ci ? { ...c, emails: c.emails.filter((_, j) => j !== ei) } : c
    ),
  }))
  const setEmail = (ci, ei, val) => setForm((f) => ({
    ...f, contactos: f.contactos.map((c, i) =>
      i === ci ? { ...c, emails: c.emails.map((e, j) => j === ei ? val : e) } : c
    ),
  }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setSaving(true)
    try {
      const payload = { ...form, companyId, grupo: form.origenContacto }
      if (isEdit) {
        await updateLead(lead.id, payload)
        toast.success('Lead actualizado')
      } else {
        const leadId = await createLead(payload, currentUser.uid)
        if (form.observaciones.trim()) {
          await addNota(leadId, form.observaciones.trim(), 'nota', currentUser)
        }
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

          {/* Personas de contacto */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Personas de contacto</label>
              <button type="button" onClick={addContacto} className="text-xs text-brand-orange hover:underline font-medium">
                + Agregar persona
              </button>
            </div>
            <div className="space-y-3">
              {form.contactos.map((c, ci) => (
                <div key={ci} className="border border-brand-border rounded-xl p-3 space-y-3 bg-brand-bg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brand-text-muted uppercase tracking-wide">
                      Contacto {ci + 1}
                    </span>
                    {form.contactos.length > 1 && (
                      <button type="button" onClick={() => removeContacto(ci)} className="text-xs text-red-500 hover:underline">
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Nombre</label>
                      <input
                        className="input-field"
                        value={c.nombre}
                        onChange={(e) => setContacto(ci, 'nombre', e.target.value)}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div>
                      <label className="label">Puesto</label>
                      <select className="select-field" value={c.puesto} onChange={(e) => setContacto(ci, 'puesto', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {PUESTOS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input
                      className="input-field"
                      value={c.telefono}
                      onChange={(e) => setContacto(ci, 'telefono', e.target.value)}
                      placeholder="+54 11 ..."
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label mb-0">Emails</label>
                      {c.emails.length < 5 && (
                        <button type="button" onClick={() => addEmail(ci)} className="text-xs text-brand-orange hover:underline font-medium">
                          + Agregar email
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {c.emails.map((email, ei) => (
                        <div key={ei} className="flex items-center gap-2">
                          <input
                            className="input-field flex-1"
                            type="text"
                            value={email}
                            onChange={(e) => setEmail(ci, ei, e.target.value)}
                            placeholder={`Email ${ei + 1}`}
                          />
                          {c.emails.length > 1 && (
                            <button type="button" onClick={() => removeEmail(ci, ei)} className="text-brand-text-muted hover:text-red-500 p-1">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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

          {/* Kilos mensuales + Fecha cierre (solo en Contactos) */}
          {showContactoFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kilos mensuales</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  value={form.kilosMensuales}
                  onChange={(e) => set('kilosMensuales', e.target.value)}
                  placeholder="Ej: 500"
                />
              </div>
              <div>
                <label className="label">Fecha estimada de cierre</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.fechaCierre}
                  onChange={(e) => set('fechaCierre', e.target.value)}
                />
              </div>
            </div>
          )}

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
