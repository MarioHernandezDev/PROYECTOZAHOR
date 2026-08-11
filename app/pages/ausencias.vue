<script setup>
import { ref, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()

// Estado del Formulario
const diaSeleccionado = ref(1) // 1 = Lunes
const profesorAusenteId = ref(null)
const horasSeleccionadas = ref([]) // Ej: [4, 5, 6]

// Datos de Supabase
const profesores = ref([])
const resultadoAusencia = ref([]) // Contendrá el diagnóstico por cada hora
const cargando = ref(true)
const buscando = ref(false)

const dias = [
  { id: 1, nombre: 'Lunes' },
  { id: 2, nombre: 'Martes' },
  { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' },
  { id: 5, nombre: 'Viernes' }
]
const horas = [1, 2, 3, 4, 5, 6]

// Cargar profesores al montar
onMounted(async () => {
  const { data } = await supabase
    .from('profesores')
    .select('*')
    .order('nombre')

  if (data?.length) {
    profesores.value = data
  }
  cargando.value = false
})

// Función Principal: Calcular el impacto de la ausencia
const calcularAusencia = async () => {
  if (!profesorAusenteId.value || horasSeleccionadas.value.length === 0) {
    resultadoAusencia.value = []
    return
  }

  buscando.value = true
  const analisis = []

  // Recorremos cada hora seleccionada para ver el impacto
  for (const horaNum of [...horasSeleccionadas.value].sort((a, b) => a - b)) {
    // 0. Obtener el ID del tramo horario correspondiente
    const { data: tramoData } = await supabase
      .from('tramos_horarios')
      .select('id')
      .eq('dia_semana', diaSeleccionado.value)
      .eq('hora_num', horaNum)
      .single()

    if (!tramoData) continue
    const tramoId = tramoData.id

    // 1. Buscar la clase que tenía asignada el profesor ausente en este tramo
    const { data: clasesAfectadas } = await supabase
      .from('clases')
      .select(`
        id,
        cursos(nombre),
        asignaturas(codigo, nombre)
      `)
      .eq('profesor_id', profesorAusenteId.value)
      .eq('tramo_id', tramoId)

    // 2. Buscar Profesores que están de GUARDIA a esa misma hora
    const { data: profesEnGuardia } = await supabase
      .from('clases')
      .select(`
        profesores!inner(id, nombre),
        asignaturas!inner(codigo)
      `)
      .eq('tramo_id', tramoId)
      .ilike('asignaturas.codigo', '%GUARDIA%')

    // Filtrar para eliminar duplicados si un profe tiene guardia de media hora
    const guardiasUnicas = []
    const idsGuardiaVistos = new Set()
    
    if (profesEnGuardia) {
      profesEnGuardia.forEach(item => {
        if (item.profesores && !idsGuardiaVistos.has(item.profesores.id)) {
          idsGuardiaVistos.add(item.profesores.id)
          guardiasUnicas.push(item.profesores)
        }
      })
    }

    // 3. Buscar profesores ocupados (que tienen alguna clase asignada a esta hora)
    const { data: ocupados } = await supabase
      .from('clases')
      .select('profesor_id')
      .eq('tramo_id', tramoId)
      .not('profesor_id', 'is', null)

    const idsOcupados = new Set(ocupados?.map(c => c.profesor_id) || [])
    
    // Profesores Libres = Toda la plantilla - Ocupados - Profesor Ausente
    const profesLibres = profesores.value.filter(
      p => !idsOcupados.has(p.id) && p.id !== profesorAusenteId.value
    )

    analisis.push({
      horaNum,
      claseAfectada: clasesAfectadas?.[0] || null,
      profesGuardia: guardiasUnicas,
      profesLibres
    })
  }

  resultadoAusencia.value = analisis
  buscando.value = false
}

// Recalcular automáticamente ante cualquier cambio
watch([diaSeleccionado, profesorAusenteId, horasSeleccionadas], () => {
  calcularAusencia()
}, { deep: true })

const toggleHora = (h) => {
  if (horasSeleccionadas.value.includes(h)) {
    horasSeleccionadas.value = horasSeleccionadas.value.filter(item => item !== h)
  } else {
    horasSeleccionadas.value.push(h)
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 font-sans text-zinc-900 md:max-w-6xl">
    
    <header class="mb-8">
      <div class="border-l-4 border-zinc-900 pl-4">
        <h1 class="text-3xl font-black tracking-tight text-zinc-900">Ausencias y Guardias</h1>
        <p class="text-zinc-600 font-medium text-sm mt-0.5">Gestor rápido de sustituciones e incidencias</p>
      </div>
    </header>

    <div v-if="cargando" class="flex justify-center py-12">
      <p class="text-base font-bold text-zinc-700 animate-pulse">Cargando profesores...</p>
    </div>

    <div v-else class="space-y-8">
      
      <section class="bg-white p-6 rounded-3xl border-2 border-zinc-200 shadow-xs space-y-6">
        
        <div>
          <label class="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            1. ¿Qué día falta?
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              v-for="d in dias"
              :key="d.id"
              type="button"
              @click="diaSeleccionado = d.id"
              :class="[
                'py-3 px-2 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all',
                diaSeleccionado === d.id
                  ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300'
              ]"
            >
              {{ d.nombre }}
            </button>
          </div>
        </div>

        <div>
          <label for="profesor-ausente" class="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            2. ¿Qué profesor/a falta?
          </label>
          <div class="relative">
            <select 
              id="profesor-ausente"
              v-model="profesorAusenteId" 
              class="w-full appearance-none bg-white border-2 border-zinc-300 text-zinc-900 font-black rounded-2xl px-5 py-4 text-base focus:border-zinc-900 focus:outline-none transition-all cursor-pointer shadow-sm"
            >
              <option :value="null" disabled>-- DOCENTE --</option>
              <option v-for="p in profesores" :key="p.id" :value="p.id">
                {{ p.nombre }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-zinc-800">
              <svg width="14" height="9" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            3. ¿A qué horas no estará? <span class="font-bold text-zinc-500 lowercase">(toca varias si es necesario)</span>
          </label>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <button 
              v-for="h in horas" 
              :key="h"
              type="button"
              @click="toggleHora(h)"
              :class="[
                'py-3 px-3 rounded-2xl text-xs font-black transition-all border-2 flex items-center justify-center gap-1.5',
                horasSeleccionadas.includes(h)
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                  : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:border-zinc-300'
              ]"
            >
              <span>{{ h }}ª Hora</span>
              <span v-if="horasSeleccionadas.includes(h)" class="text-xs">✓</span>
            </button>
          </div>
        </div>

      </section>

      <div v-if="buscando" class="flex justify-center py-8">
        <p class="text-base font-bold text-zinc-700 animate-pulse">Analizando huecos y guardias...</p>
      </div>

      <div v-else-if="resultadoAusencia.length" class="space-y-4">
        <div class="flex items-center justify-between border-b-2 border-zinc-200 pb-2">
          <h2 class="text-lg font-black text-zinc-900 uppercase tracking-wide">
            Opciones de Cobertura
          </h2>
          <span class="text-xs font-black bg-zinc-200 text-zinc-800 px-3 py-1 rounded-full">
            {{ resultadoAusencia.length }} {{ resultadoAusencia.length === 1 ? 'sesión' : 'sesiones' }}
          </span>
        </div>

        <div class="space-y-4">
          <div 
            v-for="item in resultadoAusencia" 
            :key="item.horaNum"
            class="bg-white rounded-3xl border-2 border-zinc-200 p-5 shadow-xs flex flex-col md:flex-row gap-5"
          >
            <div class="md:w-1/3 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-200 pb-4 md:pb-0 md:pr-4">
              <div>
                <span class="inline-block px-3 py-1 bg-zinc-900 text-white font-black text-xs rounded-xl mb-3">
                  {{ item.horaNum }}ª HORA
                </span>
                
                <div v-if="item.claseAfectada" class="space-y-1">
                  <span class="text-xs font-black uppercase text-amber-700 tracking-wider block">
                    Clase desatendida:
                  </span>
                  <p class="font-black text-zinc-950 text-xl leading-tight">
                    {{ item.claseAfectada.cursos?.nombre || 'General' }}
                  </p>
                  <p class="text-sm font-bold text-zinc-700">
                    {{ item.claseAfectada.asignaturas?.nombre || item.claseAfectada.asignaturas?.codigo }}
                  </p>
                </div>

                <div v-else class="py-2">
                  <span class="text-xs font-extrabold text-zinc-400 uppercase tracking-wide">
                    Sin clase asignada en este hueco
                  </span>
                </div>
              </div>
            </div>

            <div class="md:w-1/3 bg-amber-500/10 p-4 rounded-2xl border-2 border-amber-300/60 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black uppercase text-amber-950 tracking-wider">
                    Profesores de Guardia
                  </span>
                  <span class="text-xs font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-md">
                    {{ item.profesGuardia.length }}
                  </span>
                </div>

                <div v-if="item.profesGuardia.length" class="flex flex-wrap gap-1.5 mt-2">
                  <span 
                    v-for="p in item.profesGuardia" 
                    :key="p.id"
                    class="px-3 py-1.5 bg-amber-300 border border-amber-400 text-amber-950 font-black text-xs rounded-xl shadow-2xs"
                  >
                    {{ p.nombre }}
                  </span>
                </div>
                <p v-else class="text-xs font-bold text-amber-800/80 italic mt-1">
                  Nadie tiene hora de guardia asignada.
                </p>
              </div>
            </div>

            <div class="md:w-1/3 bg-zinc-50 p-4 rounded-2xl border-2 border-zinc-200 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-black uppercase text-zinc-700 tracking-wider">
                    Otros Libres / Huecos
                  </span>
                  <span class="text-xs font-black bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-md">
                    {{ item.profesLibres.length }}
                  </span>
                </div>

                <div v-if="item.profesLibres.length" class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto mt-2">
                  <span 
                    v-for="p in item.profesLibres" 
                    :key="p.id"
                    class="px-2.5 py-1 bg-white text-zinc-900 border border-zinc-300 font-bold text-xs rounded-lg shadow-2xs"
                  >
                    {{ p.nombre }}
                  </span>
                </div>
                <p v-else class="text-xs font-bold text-zinc-500 italic mt-1">
                  No hay profesores libres a esta hora.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div 
        v-else 
        class="bg-zinc-100 rounded-3xl p-8 text-center border-2 border-dashed border-zinc-300 my-4"
      >
        <div class="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 font-black text-xl">
          i
        </div>
        <h3 class="text-lg font-black text-zinc-900 mb-1">Completa los datos de arriba</h3>
        <p class="text-xs font-bold text-zinc-600 max-w-xs mx-auto">
          Elige el profesor/a que falta y al menos una hora para calcular quién puede hacer la guardia.
        </p>
      </div>

    </div>
  </div>
</template>