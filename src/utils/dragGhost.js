// Imagen de arrastre liviana y prolija en vez del screenshot semi-transparente
// que usa el navegador por default (que además no coincide con la tarjeta atenuada
// que queda en la lista mientras se arrastra).
export function setDragGhost(e, label) {
  const ghost = document.createElement('div')
  ghost.textContent = label
  ghost.style.cssText = [
    'position:fixed', 'top:-1000px', 'left:-1000px',
    'padding:6px 12px', 'border-radius:8px',
    'background:#1C1917', 'color:#fff',
    'font:600 12px system-ui,sans-serif',
    'box-shadow:0 4px 12px rgba(0,0,0,.25)',
    'max-width:220px', 'white-space:nowrap',
    'overflow:hidden', 'text-overflow:ellipsis', 'pointer-events:none',
  ].join(';')
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 12, 12)
  setTimeout(() => ghost.remove(), 0)
}
