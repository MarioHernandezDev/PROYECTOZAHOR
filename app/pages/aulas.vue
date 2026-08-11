<script setup>
import { ref, onMounted, watch } from 'vue'

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
      asignaturas(codigo, nombre, color_hex)
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
        c => c.asignaturas?.codigo === cod && c.posicion_media_hora === item.posicion_media_hora
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

const getClasesCelda = (diaId, horaNum) => {
  return clasesMapa.value[`${diaId}-${horaNum}`] || []
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 font-sans text-zinc-900 md:max-w-6xl">
    
    <header class="mb-8">
      <div class="flex flex-col gap-5">
        <div class="border-l-4 border-zinc-900 pl-4">
          <h1 class="text-3xl font-black tracking-tight text-zinc-900">Horario de Cursos</h1>
          <p class="text-zinc-600 font-medium text-sm mt-0.5">Distribución semanal por grupo / aula</p>
        </div>

        <div v-if="!cargando && cursos.length" class="w-full">
          <label for="curso" class="block text-xs font-black uppercase text-zinc-700 tracking-wider mb-2">
            Curso / Grupo
          </label>
          <div class="relative">
            <select 
              id="curso"
              v-model="cursoSeleccionado" 
              class="w-full appearance-none bg-white border-2 border-zinc-300 text-zinc-900 font-black rounded-2xl px-5 py-4 text-lg focus:border-zinc-900 focus:outline-none transition-all cursor-pointer shadow-sm"
            >
              <option :value="null" disabled>
                -- Seleccionar grupo / curso --
              </option>
              <option v-for="c in cursos" :key="c.id" :value="c.id">
                {{ c.nombre }} <template v-if="c.etapa">({{ c.etapa }})</template>
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-zinc-800">
              <svg width="14" height="9" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div v-if="cargando" class="flex justify-center py-12">
      <p class="text-base font-bold text-zinc-700 animate-pulse">Cargando grupos y aulas...</p>
    </div>

    <div v-else-if="!cursoSeleccionado" class="bg-zinc-100 rounded-3xl p-8 text-center border-2 border-dashed border-zinc-300 my-8">
      <div class="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-xl">
        ?
      </div>
      <h3 class="text-xl font-black text-zinc-900 mb-1">Ningún curso seleccionado</h3>
      <p class="text-sm font-semibold text-zinc-600 max-w-xs mx-auto">
        Despliega la lista de arriba y elige una clase para ver su horario semanal.
      </p>
    </div>

    <div v-else-if="cargandoHorario" class="flex justify-center py-12">
      <p class="text-base font-bold text-zinc-700 animate-pulse">Obteniendo horario de la clase...</p>
    </div>

    <div v-else>
      <div class="block md:hidden">
        <div class="grid grid-cols-2 gap-3 mb-6">
          <button
            v-for="dia in dias"
            :key="dia.id"
            @click="diaMovilActivo = dia.id"
            :class="[
              'py-4 px-3 rounded-2xl font-black text-base transition-all text-center border-2 uppercase tracking-wide',
              diaMovilActivo === dia.id 
                ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' 
                : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-400'
            , dia.nombre === 'Viernes' ? 'col-span-2' : '']"
          >
            {{ dia.nombre }}
          </button>
        </div>

        <div class="space-y-5">
          <div 
            v-for="hora in horas" 
            :key="hora" 
            class="bg-white rounded-3xl p-4 border-2 border-zinc-200 shadow-xs"
          >
            <div class="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
              <span class="text-sm font-black text-zinc-800 uppercase tracking-wider">
                {{ hora }}ª Sesión
              </span>
            </div>

            <div v-if="getClasesCelda(diaMovilActivo, hora).length" class="grid gap-2 grid-cols-1">
              <div 
                v-for="clase in getClasesCelda(diaMovilActivo, hora)" 
                :key="clase.id"
                class="p-4 rounded-2xl border-2 flex items-start justify-between gap-3"
                :style="{ 
                  backgroundColor: (clase.asignaturas?.color_hex || '#18181b') + '15',
                  borderColor: clase.asignaturas?.color_hex || '#18181b'
                }"
              >
                <div class="flex flex-col">
                  <div v-if="clase.es_media_hora" class="mb-1">
                    <span class="text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white px-2 py-0.5 rounded-md">
                      30 min (Bloque {{ clase.posicion_media_hora || 1 }})
                    </span>
                  </div>
                  
                  <span class="text-lg font-black leading-tight text-zinc-950">
                    {{ clase.asignaturas?.nombre || clase.asignaturas?.codigo }}
                  </span>
                </div>

                <div 
                  class="w-6 h-6 rounded-full flex-none mt-1 border border-black/10"
                  :style="{ backgroundColor: clase.asignaturas?.color_hex || '#18181b' }"
                ></div>
              </div>
            </div>

            <div v-else class="py-3 px-4 bg-zinc-100/70 rounded-2xl border border-dashed border-zinc-300">
              <span class="text-xs font-extrabold text-zinc-500 uppercase tracking-wider">Sin clase / Descanso</span>
            </div>
          </div>
        </div>
      </div>

      <div class="hidden md:block bg-white rounded-3xl border-2 border-zinc-200 overflow-hidden shadow-xs">
        <div class="grid grid-cols-6 bg-zinc-100 border-b-2 border-zinc-200">
          <div class="p-5 text-center text-xs font-black uppercase tracking-wider text-zinc-700">Sesión</div>
          <div v-for="dia in dias" :key="dia.id" class="p-5 text-center text-xs font-black uppercase tracking-wider text-zinc-900">
            {{ dia.nombre }}
          </div>
        </div>

        <div v-for="hora in horas" :key="hora" class="grid grid-cols-6 border-b border-zinc-200 last:border-b-0">
          <div class="p-4 flex items-center justify-center bg-zinc-50 border-r border-zinc-200">
            <span class="text-xl font-black text-zinc-700">{{ hora }}ª</span>
          </div>

          <div 
            v-for="dia in dias" 
            :key="dia.id" 
            class="p-2 border-l border-zinc-200 min-h-[120px] bg-white flex flex-col justify-stretch"
          >
            <div 
              v-if="getClasesCelda(dia.id, hora).length" 
              :class="['h-full grid gap-1.5', getClasesCelda(dia.id, hora).length > 1 ? 'grid-cols-2' : 'grid-cols-1']"
            >
              <div 
                v-for="clase in getClasesCelda(dia.id, hora)" 
                :key="clase.id"
                class="p-2.5 rounded-xl border-2 flex flex-col justify-between"
                :style="{ 
                  backgroundColor: (clase.asignaturas?.color_hex || '#18181b') + '15',
                  borderColor: clase.asignaturas?.color_hex || '#18181b'
                }"
              >
                <div>
                  <span 
                    v-if="clase.es_media_hora" 
                    class="inline-block text-[9px] font-black uppercase bg-zinc-900 text-white px-1.5 py-0.5 rounded mb-1"
                  >
                    1/2h
                  </span>
                  <p class="text-xs font-black leading-snug text-zinc-950">
                    {{ clase.asignaturas?.nombre || clase.asignaturas?.codigo }}
                  </p>
                </div>
              </div>
            </div>

            <div v-else class="h-full flex items-center justify-center">
              <span class="text-xs font-bold text-zinc-400">—</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>