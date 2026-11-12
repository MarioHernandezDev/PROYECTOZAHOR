<script setup>
// Iconos de la app: todos del mismo estilo (línea fina, esquinas redondeadas) y de un solo color (el del texto que los rodea).
defineProps({ name: { type: String, required: true }, size: { type: [Number, String], default: 24 }, stroke: { type: Number, default: 2 } })
const ICONOS = {
  home: '<path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 9.8V19a1.5 1.5 0 0 0 1.5 1.5h3.2v-5.2h3.6v5.2H17a1.5 1.5 0 0 0 1.5-1.5V9.8"/>',
  servicios: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 13h18"/>',
  consultas: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/>',
  refuerzos: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  sustituciones: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  recreos: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5v2M12 3.5v2"/>',
  ausencias: '<circle cx="9.5" cy="8" r="3.8"/><path d="M2.8 20c.5-3.6 3.2-5.6 6.7-5.6s6.2 2 6.7 5.6"/><path d="m17.5 8.5 4 4M21.5 8.5l-4 4"/>',
  profesores: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-4 3.6-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/>',
  cursos: '<path d="M12 6.5C10.2 5 7.6 4.5 4 4.5v13c3.6 0 6.2.5 8 2 1.8-1.5 4.4-2 8-2v-13c-3.6 0-6.2.5-8 2Z"/><path d="M12 6.5v13"/>',
  editar: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  salir: '<path d="M9.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3.5"/><path d="m15 8 4 4-4 4M19 12H9.5"/>',
  whatsapp: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 20.5 11.5Z"/><path d="M9.2 9.2c0 3 2.6 5.6 5.6 5.6l1-1.6-2-1-.8.8a3.7 3.7 0 0 1-1.8-1.8l.8-.8-1-2-1.8 1Z"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'flecha-abajo': '<path d="m6 9 6 6 6-6"/>',
  'flecha-arriba': '<path d="m6 15 6-6 6 6"/>',
  'flecha-izq': '<path d="m15 6-6 6 6 6"/>',
  'flecha-der': '<path d="m9 6 6 6-6 6"/>',
  aviso: '<path d="M12 4 2.8 19.5h18.4L12 4Z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  intercambio: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  obras: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>'
}
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="stroke"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0" v-html="ICONOS[name] || ''" />
</template>
