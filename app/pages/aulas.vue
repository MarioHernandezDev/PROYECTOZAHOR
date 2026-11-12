<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()

// Estado
const cursos = ref([])
// Inicializamos en null para mostrar el mensaje de "Seleccionar grupo/curso"
const cursoSeleccionado = ref(null)
const clasesMapa = ref({})
const cargando = ref(true)
const cargandoHorario = ref(false)

// Día activo para vista móvil
const diaMovilActivo = ref(1)

// Días y Horas
const dias = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' }
]
const horas = [1, 2, 3, 4, 5, 6]

// Cargar cursos al montar
onMounted(async () => {
  const { data, error } = await supabase
    .from('cursos')
    .select('*')
    .order('nombre')

  if (!error && data?.length) {
    cursos.value = data
    // No autoseleccionamos ninguno para forzar la elección clara
  }
  cargando.value = false
})

// Cargar clases del curso seleccionado
const cargarHorarioCurso = async (cursoId) => {
  if (!cursoId) return
  cargandoHorario.value = true
  clasesMapa.value = {}

  const { data, error } = await supabase
    .from('clases')
    .select(`
      id,
      es_media_hora,
      posicion_media_hora,
      tramos_horarios!inner(dia_semana, hora_num),
      asignaturas(id, codigo, nombre, color_hex),
      profesores(nombre)
    `)
    .eq('curso_id', cursoId)

  if (!error && data) {
    data.forEach(item => {
      // Filtrar códigos que sean nombres de cursos repetidos o vacíos
      const cod = item.asignaturas?.codigo || ''
      if (cod.includes('PRIMARIA') || cod.includes('AÑOS') || cod.includes('ESO')) {
        return // Ignorar si el código registrado es la etiqueta del propio curso
      }

      const dia = item.tramos_horarios.dia_semana
      const hora = item.tramos_horarios.hora_num
      const key = `${dia}-${hora}`

      if (!clasesMapa.value[key]) {
        clasesMapa.value[key] = []
      }

      // Evitar duplicados exactos en la misma celda/posición
      const yaExiste = clasesMapa.value[key].some(
        c => c.asignaturas?.codigo === cod && c.posicion_media_hora === item.posicion_media_hora && c.profesores?.nombre === item.profesores?.nombre
      )

      if (!yaExiste) {
        clasesMapa.value[key].push(item)
      }
    })

    // Ordenar medias horas para que la 1ª vaya antes que la 2ª
    Object.keys(clasesMapa.value).forEach(key => {
      clasesMapa.value[key].sort((a, b) => (a.posicion_media_hora || 0) - (b.posicion_media_hora || 0))
    })
  }

  cargandoHorario.value = false
}

// Escuchar cambios de curso
watch(cursoSeleccionado, (nuevoId) => {
  if (nuevoId) {
    cargarHorarioCurso(nuevoId)
  }
})

const etapaCurso = computed(() => cursos.value.find(c => c.id === cursoSeleccionado.value)?.etapa)
const rangoHora = (h) => horaRango(h, etapaCurso.value)

const getClasesCelda = (diaId, horaNum) => {
  return clasesMapa.value[`${diaId}-${horaNum}`] || []
}
</script>

<template>
  <div class="max-w-xl mx-auto md:max-w-6xl font-sans text-zinc-900">

    <header class="mb-6">
      <h1 class="text-3xl font-black tracking-tight">Cursos</h1>
      <p class="text-zinc-600 font-semibold mt-1">Elige un curso y mira su semana</p>
    </header>

    <div v-if="!cargando && cursos.length" class="mb-6">
      <div class="relative">
        <select v-model="cursoSeleccionado"
          class="w-full appearance-none bg-white border border-zinc-300 shadow-sm text-zinc-900 font-black rounded-full pl-6 pr-12 h-16 text-lg focus:outline-none focus:ring-2 focus:ring-zinc-900">
          <option :value="null" disabled>Elegir curso…</option>
          <option v-for="c in cursos" :key="c.id" :value="c.id">{{ cursoLargo(c) }}</option>
        </select>
        <svg class="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2" width="16" height="10" viewBox="0 0 12 8" fill="none"><path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
      </div>
    </div>

    <p v-if="cargando" class="text-center py-12 font-bold animate-pulse">Cargando…</p>

    <div v-else-if="!cursoSeleccionado" class="bg-white rounded-3xl p-8 text-center border border-dashed border-zinc-300">
      <div class="w-20 h-20 mx-auto mb-3 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center"><Icono name="cursos" :size="38" /></div>
      <p class="text-xl font-black">Elige el curso que quieres ver</p>
    </div>

    <p v-else-if="cargandoHorario" class="text-center py-12 font-bold animate-pulse">Buscando el horario…</p>

    <div v-else>
      <!-- ===== Móvil: un día cada vez ===== -->
      <div class="md:hidden">
        <div class="grid grid-cols-5 gap-2 mb-5">
          <button v-for="dia in dias" :key="dia.id" @click="diaMovilActivo = dia.id"
            :class="['h-14 rounded-full font-black text-base transition-colors',
              diaMovilActivo === dia.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-700 active:bg-zinc-100']">
            {{ dia.nombre.slice(0, 3) }}
          </button>
        </div>
        <p class="text-lg font-black mb-3">{{ dias[diaMovilActivo - 1].nombre }}</p>

        <div class="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <template v-for="hora in horas" :key="hora">
            <div v-if="hora === 4" class="p-3 bg-zinc-50 border-t border-zinc-200"><Recreo /></div>
            <div :class="['grid grid-cols-[4.25rem_1fr] gap-3 p-3 items-start', hora !== 1 ? 'border-t border-zinc-200' : '']">
              <div class="text-center pt-2">
                <p class="text-2xl font-black leading-none">{{ hora }}ª</p>
                <p class="text-xs font-bold text-zinc-600 mt-1">{{ (rangoHora(hora) || '9:00').split('–')[0] }}</p>
              </div>
              <CeldaClase v-if="getClasesCelda(diaMovilActivo, hora).length" :items="getClasesCelda(diaMovilActivo, hora)" modo="curso" />
              <div v-else class="py-3 px-1 text-base font-bold text-zinc-500">
                {{ rangoHora(hora) ? 'Sin clase' : 'Aún no empiezan (9:00)' }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- ===== Ordenador: semana entera ===== -->
      <div class="hidden md:block bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div class="grid grid-cols-[6rem_repeat(5,1fr)] bg-zinc-100 border-b border-zinc-200">
          <div></div>
          <div v-for="dia in dias" :key="dia.id" class="p-4 text-center text-base font-black">{{ dia.nombre }}</div>
        </div>
        <template v-for="hora in horas" :key="hora">
          <div v-if="hora === 4" class="p-2 bg-zinc-50 border-t border-zinc-200"><Recreo /></div>
          <div class="grid grid-cols-[6rem_repeat(5,1fr)] border-t border-zinc-200 first:border-t-0">
            <div class="p-3 flex flex-col items-center justify-center bg-zinc-50">
              <span class="text-2xl font-black">{{ hora }}ª</span>
              <span class="text-xs font-bold text-zinc-600">{{ rangoHora(hora) || '—' }}</span>
            </div>
            <div v-for="dia in dias" :key="dia.id" class="p-2 border-l border-zinc-200 min-h-[5.5rem]">
              <CeldaClase v-if="getClasesCelda(dia.id, hora).length" :items="getClasesCelda(dia.id, hora)" modo="curso" compacto />
              <span v-else class="block text-center text-zinc-300 font-bold pt-5">—</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
