<script setup>
// Una "casilla" del horario. modo 'profesor': muestra a qué curso da clase. modo 'curso': muestra qué profesor la da,
// y separa las clases con apoyo (refuerzo, PT, desdoble…) para que se vea quién lleva la clase y quién ayuda.
const props = defineProps({ items: { type: Array, default: () => [] }, modo: { type: String, default: 'profesor' }, compacto: Boolean })

const esApoyo = (i) => CODIGOS_APOYO.includes(i.asignaturas?.codigo)
const principales = computed(() => props.modo === 'curso' ? props.items.filter(i => !esApoyo(i)) : props.items)
const apoyos = computed(() => props.modo === 'curso' && principales.value.length ? props.items.filter(esApoyo) : [])
const mostrar = computed(() => props.modo === 'curso' && !principales.value.length ? props.items : principales.value)

const grupos = computed(() => {
  const m = new Map()
  mostrar.value.forEach(i => {
    const a = i.asignaturas
    const key = props.modo === 'curso' ? `${a?.id ?? a?.codigo}|${i.profesores?.nombre}` : `${a?.id ?? a?.codigo}`
    if (!m.has(key)) m.set(key, { key, nombre: a?.nombre || a?.codigo, color: a?.color_hex || '#18181b', subs: [] })
    const sub = props.modo === 'curso' ? i.profesores?.nombre : cursoLargo(i.cursos)
    if (sub && !m.get(key).subs.includes(sub)) m.get(key).subs.push(sub)
  })
  return [...m.values()]
})
</script>

<template>
  <div class="space-y-2">
    <div v-for="g in grupos" :key="g.key" class="rounded-2xl border-l-[6px]"
      :class="compacto ? 'pl-3 pr-2 py-2' : 'pl-4 pr-3 py-3'"
      :style="{ borderColor: g.color, backgroundColor: g.color + '16' }">
      <p :class="['font-black leading-tight text-zinc-950', compacto ? 'text-sm' : 'text-lg']">{{ g.nombre }}</p>
      <p v-if="g.subs.length" :class="['font-bold text-zinc-700 leading-snug', compacto ? 'text-sm' : 'text-base']">{{ g.subs.join(' · ') }}</p>
    </div>
    <div v-if="apoyos.length" class="flex flex-wrap items-center gap-1.5">
      <span class="text-xs font-black uppercase tracking-wide text-zinc-600">Con apoyo:</span>
      <span v-for="a in apoyos" :key="a.id" class="bg-yellow-100 text-yellow-900 text-sm font-bold rounded-2xl px-3 py-1">
        {{ a.asignaturas?.nombre }} · {{ a.profesores?.nombre }}
      </span>
    </div>
  </div>
</template>
