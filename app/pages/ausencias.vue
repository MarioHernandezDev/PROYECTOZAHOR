<script setup>
import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()

// Formulario
const diaSeleccionado = ref(1) // 1 = Lunes
const profesorAusenteId = ref(null)
const horasSeleccionadas = ref([]) // Ej: [4, 5, 6]

// Datos (se cargan una vez y todo se calcula en el móvil: más rápido y sin esperas)
const profesores = ref([])
const asignaturas = ref([])
const tramos = ref([])
const clases = ref([])
const cargando = ref(true)

const dias = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' }
]
const horas = [1, 2, 3, 4, 5, 6]

onMounted(async () => {
  const [p, a, t, c] = await Promise.all([
    supabase.from('profesores').select('*').order('nombre'),
    supabase.from('asignaturas').select('*'),
    supabase.from('tramos_horarios').select('*'),
    supabase.from('clases').select('id, profesor_id, asignatura_id, tramo_id, nota, cursos(nombre, etapa)').limit(5000)
  ])
  profesores.value = p.data || []
  asignaturas.value = a.data || []
  tramos.value = t.data || []
  clases.value = c.data || []
  cargando.value = false
})

const asigPorId = computed(() => Object.fromEntries(asignaturas.value.map(a => [a.id, a])))
const profPorId = computed(() => Object.fromEntries(profesores.value.map(p => [p.id, p])))

// ¿Esta materia permite sustituir? Se marca en Editar > Materias ("Puede sustituir").
// Si la columna aún no existe, se usa la guardia de siempre.
const puedeSustituir = (asigId) => {
  const a = asigPorId.value[asigId]
  return !!a && (a.sustituye ?? a.codigo === 'GUARDIA')
}

// Etapa de cada profesor: si da clase a ESO entra a las 8:00; si no, a las 9:00.
// Los que no tienen ninguna clase cargada (p. ej. tutoras de Infantil) no se ofrecen como "libres".
const etapaProf = computed(() => {
  const m = new Map()
  clases.value.forEach(c => {
    if (!c.profesor_id) return
    if (c.cursos?.etapa === 'SECUNDARIA') m.set(c.profesor_id, 'SECUNDARIA')
    else if (!m.has(c.profesor_id)) m.set(c.profesor_id, 'PRIMARIA')
  })
  return m
})

const resultadoAusencia = computed(() => {
  const ausenteId = profesorAusenteId.value
  if (!ausenteId || !horasSeleccionadas.value.length) return []
  return [...horasSeleccionadas.value].sort((a, b) => a - b).map(horaNum => {
    const tramo = tramos.value.find(t => t.dia_semana === diaSeleccionado.value && t.hora_num === horaNum)
    if (!tramo) return null
    const enTramo = clases.value.filter(c => c.tramo_id === tramo.id)
    const afectadas = enTramo.filter(c => c.profesor_id === ausenteId)

    // Cada posible sustituto con el motivo por el que puede cubrir (Guardia, TDE, RP...)
    const porProfe = new Map()
    enTramo.forEach(c => {
      if (!c.profesor_id || c.profesor_id === ausenteId || !puedeSustituir(c.asignatura_id)) return
      const e = porProfe.get(c.profesor_id) || { ...profPorId.value[c.profesor_id], motivos: [], nota: null }
      const m = motivoCorto(asigPorId.value[c.asignatura_id])
      if (!e.motivos.includes(m)) e.motivos.push(m)
      if (c.nota) e.nota = c.nota
      porProfe.set(c.profesor_id, e)
    })
    const prioridad = (e) => (e.motivos.includes('Guardia') ? 0 : 1)
    const profesGuardia = [...porProfe.values()].sort((a, b) => prioridad(a) - prioridad(b) || a.nombre.localeCompare(b.nombre))

    const ocupados = new Set(enTramo.map(c => c.profesor_id))
    const profesLibres = profesores.value.filter(p =>
      !ocupados.has(p.id) && p.id !== ausenteId && etapaProf.value.has(p.id) &&
      (horaNum !== 1 || etapaProf.value.get(p.id) === 'SECUNDARIA') // a 1ª hora solo está el profesorado de ESO
    )

    const etapa = afectadas[0]?.cursos?.etapa || etapaProf.value.get(ausenteId) || 'SECUNDARIA'
    return {
      horaNum,
      clasesAfectadas: afectadas,
      profesGuardia,
      profesLibres,
      rango: horaRango(horaNum, etapa),
      sinClaseEtapa: !horaRango(horaNum, etapa)
    }
  }).filter(Boolean)
})

const motivoCorto = (a) => ({ GUARDIA: 'Guardia', '55': '+55 años', CORD: 'Coordinación', RP: 'Refuerzo' }[a?.codigo] || a?.codigo || a?.nombre || '')

const nombreDia = () => dias.find(d => d.id === diaSeleccionado.value)?.nombre.toLowerCase()

// Texto que verá el profesor sustituto como borrador de WhatsApp
const mensajeWhatsapp = (sustituto, item) => {
  const aula = [...new Set(item.clasesAfectadas.map(c => cursoLargo(c.cursos)).filter(Boolean))].join(' y ')
  const horario = item.rango ? `de ${item.rango.replace('–', ' a ')}` : `a ${item.horaNum}ª hora`
  // "Hoy" si la falta es de hoy; si no, "El jueves", "El lunes"…
  const cuando = new Date().getDay() === diaSeleccionado.value ? 'Hoy' : `El ${nombreDia()}`
  return [
    `¡Hola, ${sustituto.nombre}! 👋😊`,
    '',
    `¡${cuando} necesitamos tus superpoderes! 🦸‍♀️🦸‍♂️✨`,
    '',
    ...(aula ? [`📍 Aula: ${aula}`] : []),
    `⏰ Horario: ${horario}.`,
    '',
    '¡Contamos contigo! 💪😃',
    '',
    'Por favor, confirma que has recibido y leído este mensaje respondiendo a este WhatsApp. 📲',
    '',
    '¡Muchas gracias! 💙'
  ].join('\n')
}
const enlaceWhatsapp = (sustituto, item) => {
  if (!sustituto.telefono) return null
  return `https://wa.me/${sustituto.telefono}?text=${encodeURIComponent(mensajeWhatsapp(sustituto, item))}`
}

const toggleHora = (h) => {
  if (horasSeleccionadas.value.includes(h)) {
    horasSeleccionadas.value = horasSeleccionadas.value.filter(item => item !== h)
  } else {
    horasSeleccionadas.value = [...horasSeleccionadas.value, h]
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto font-sans text-zinc-900 md:max-w-6xl">

    <header class="mb-6">
      <h1 class="text-3xl font-black tracking-tight">Ausencias</h1>
      <p class="text-zinc-600 font-semibold text-sm mt-1">Quién puede cubrir y aviso por WhatsApp</p>
    </header>

    <p v-if="cargando" class="text-center py-12 font-bold text-zinc-700 animate-pulse">Cargando profesores…</p>

    <div v-else class="space-y-8">

      <!-- ===== Formulario ===== -->
      <section class="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-7">

        <div>
          <p class="text-sm font-black text-zinc-900 mb-3">1 · ¿Qué día falta?</p>
          <div class="grid grid-cols-5 gap-2">
            <button v-for="d in dias" :key="d.id" type="button" @click="diaSeleccionado = d.id"
              :class="['h-12 rounded-full font-black text-sm transition-colors',
                diaSeleccionado === d.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 active:bg-zinc-200']">
              <span class="sm:hidden">{{ d.nombre.slice(0, 3) }}</span><span class="hidden sm:inline">{{ d.nombre }}</span>
            </button>
          </div>
        </div>

        <div>
          <p class="text-sm font-black text-zinc-900 mb-3">2 · ¿Qué profesor/a falta?</p>
          <div class="relative">
            <select v-model="profesorAusenteId"
              class="w-full appearance-none bg-zinc-100 text-zinc-900 font-black rounded-full pl-6 pr-12 h-14 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900">
              <option :value="null" disabled>Elegir profesor/a…</option>
              <option v-for="p in profesores" :key="p.id" :value="p.id">{{ p.nombre }}</option>
            </select>
            <Icono name="flecha-abajo" :size="20" :stroke="3" class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700" />
          </div>
        </div>

        <div>
          <p class="text-sm font-black text-zinc-900 mb-3">3 · ¿A qué horas? <span class="font-semibold text-zinc-600">(toca varias)</span></p>
          <div class="grid grid-cols-6 gap-2">
            <button v-for="h in horas" :key="h" type="button" @click="toggleHora(h)"
              :class="['h-12 rounded-full font-black text-base whitespace-nowrap transition-colors',
                horasSeleccionadas.includes(h) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700 active:bg-zinc-200']">
              {{ h }}ª
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Resultado ===== -->
      <div v-if="resultadoAusencia.length" class="space-y-6">
        <div v-for="item in resultadoAusencia" :key="item.horaNum" class="bg-white rounded-3xl border border-zinc-200 shadow-sm p-5 space-y-5">

          <div class="flex items-center justify-between">
            <span class="px-4 py-1.5 bg-zinc-900 text-white font-black text-sm rounded-full">{{ item.horaNum }}ª hora</span>
            <span v-if="item.rango" class="text-sm font-black text-zinc-600">{{ item.rango }}</span>
          </div>

          <div v-if="item.clasesAfectadas.length" class="bg-red-50 rounded-2xl px-4 py-3">
            <p class="text-xs font-black uppercase tracking-wider text-red-700">Se queda sin profesor</p>
            <div v-for="c in item.clasesAfectadas" :key="c.id" class="mt-0.5">
              <span class="font-black text-lg">{{ cursoLargo(c.cursos) || 'General' }}</span>
              <span class="font-bold text-zinc-600"> · {{ asigPorId[c.asignatura_id]?.nombre }}</span>
            </div>
          </div>
          <div v-else class="bg-zinc-100 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-600">
            {{ item.sinClaseEtapa ? 'Primaria empieza a las 9:00: a 1ª hora solo hay clase en ESO.' : 'No tiene clase a esta hora.' }}
          </div>

          <div class="md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0">

            <!-- Pueden sustituir -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-black">Pueden sustituir</p>
                <span class="text-xs font-black bg-emerald-100 text-emerald-800 rounded-full px-2.5 py-0.5">{{ item.profesGuardia.length }}</span>
              </div>
              <div v-if="item.profesGuardia.length" class="flex flex-col gap-2.5">
                <component :is="enlaceWhatsapp(p, item) ? 'a' : 'div'" v-for="p in item.profesGuardia" :key="p.id"
                  :href="enlaceWhatsapp(p, item) || undefined" target="_blank" rel="noopener"
                  :class="['flex items-center justify-between gap-3 rounded-full pl-6 pr-3 min-h-[3.75rem] py-2',
                    p.telefono ? 'bg-emerald-500 text-white active:bg-emerald-600' : 'bg-zinc-100 text-zinc-600']">
                  <span class="min-w-0">
                    <span class="block font-black text-base leading-tight truncate">{{ p.nombre }}</span>
                    <span class="block text-xs font-extrabold uppercase tracking-wide opacity-90 leading-tight">
                      {{ p.motivos.join(' + ') }}<template v-if="p.nota"> · {{ p.nota }}</template>
                    </span>
                  </span>
                  <span v-if="p.telefono" class="shrink-0 w-11 h-11 rounded-full bg-white/25 flex items-center justify-center"><Icono name="whatsapp" :size="24" /></span>
                  <span v-else class="shrink-0 text-xs font-bold pr-3">sin móvil</span>
                </component>
              </div>
              <p v-else class="text-sm font-semibold text-zinc-600 bg-zinc-50 rounded-2xl px-4 py-3">Nadie disponible a esta hora.</p>
            </div>

            <!-- Otros libres -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-black">Otros libres</p>
                <span class="text-xs font-black bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-0.5">{{ item.profesLibres.length }}</span>
              </div>
              <div v-if="item.profesLibres.length" class="flex flex-col gap-2.5">
                <component :is="enlaceWhatsapp(p, item) ? 'a' : 'div'" v-for="p in item.profesLibres" :key="p.id"
                  :href="enlaceWhatsapp(p, item) || undefined" target="_blank" rel="noopener"
                  :class="['flex items-center justify-between gap-3 rounded-full pl-6 pr-3 h-14',
                    p.telefono ? 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300 active:bg-emerald-100' : 'bg-zinc-100 text-zinc-600']">
                  <span class="font-black text-base truncate">{{ p.nombre }}</span>
                  <span v-if="p.telefono" class="shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Icono name="whatsapp" :size="22" /></span>
                  <span v-else class="shrink-0 text-xs font-bold pr-3">sin móvil</span>
                </component>
              </div>
              <p v-else class="text-sm font-semibold text-zinc-600 bg-zinc-50 rounded-2xl px-4 py-3">No hay profesores libres a esta hora.</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-white rounded-3xl p-8 text-center border border-dashed border-zinc-300">
        <p class="text-lg font-black mb-1">Elige profesor/a y hora</p>
        <p class="text-sm font-semibold text-zinc-600 max-w-xs mx-auto">Te digo quién puede cubrir y te dejo el WhatsApp listo para enviar.</p>
      </div>
    </div>
  </div>
</template>
