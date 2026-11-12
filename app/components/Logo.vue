<script setup>
// Logo de Gestor Cole: una cuadrícula de horario dentro de un círculo oscuro
defineProps({ size: { type: [Number, String], default: 44 } })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" role="img" aria-label="Gestor Cole">
    <circle cx="32" cy="32" r="32" fill="#18181b" />
    <g fill="#fff">
      <rect x="16" y="16" width="14" height="14" rx="4" />
      <rect x="34" y="16" width="14" height="14" rx="4" opacity=".5" />
      <rect x="16" y="34" width="14" height="14" rx="4" opacity=".5" />
      <rect x="34" y="34" width="14" height="14" rx="4" />
    </g>
  </svg>
</template>
