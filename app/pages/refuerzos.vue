<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const supabase = useSupabaseClient()

// Con la ventana abierta, el fondo no debe moverse (iPhone)
const modal = ref(null)
watch(modal, (v) => { if (import.meta.client) document.body.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { if (import.meta.client) document.body.style.overflow = '' })

const vista = ref('dia')     // dia | profesor | curso
const dia = ref(1)
const cargando = ref(true)
const aviso = ref('')
const errorMsg = ref('')

const profesores = ref([])
const cursos = ref([])
const asignaturas = ref([])
const tramos = ref([])
const clases = ref([])

const dias = [
  { id: 1, nombre: 'Lunes' }, { id: 2, nombre: 'Martes' }, { id: 3, nombre: 'Miércoles' },
  { id: 4, nombre: 'Jueves' }, { id: 5, nombre: 'Viernes' }
]
const horas = [1, 2, 3, 4, 5, 6]

const toast = (m) => { aviso.value = m; setTimeout(() => { if (aviso.value === m) aviso.value = '' }, 2000) }
const fallo = (e) => { console.error(e); errorMsg.value = e?.message || 'Error'; setTimeout(() => (errorMsg.value = ''), 5000) }

async function cargar() {
  const [p, c, a, t, cl] = await Promise.all([
    supabase.from('profesores').select('*').order('nombre'),
    supabase.from('cursos').select('*').order('id'),
    supabase.from('asignaturas').select('*'),
    supabase.from('tramos_horarios').select('*'),
    supabase.from('clases').select('id, profesor_id, curso_id, asignatura_id, tramo_id').limit(5000)
  ])
  const err = p.error || c.error || a.error || t.error || cl.error
  if (err) return fallo(err)
  profesores.value = p.data; cursos.value = c.data; asignaturas.value = a.data; tramos.value = t.data; clases.value = cl.data
}
onMounted(async () => { await cargar(); cargando.value = false })

const asigPorId = computed(() => Object.fromEntries(asignaturas.value.map(a => [a.id, a])))
const cursoPorId = computed(() => Object.fromEntries(cursos.value.map(c => [c.id, c])))
const profPorId = computed(() => Object.fromEntries(profesores.value.map(p => [p.id, p])))
const tramoPorId = computed(() => Object.fromEntries(tramos.value.map(t => [t.id, t])))
const rp = computed(() => asignaturas.value.find(a => a.codigo === 'RP'))
const tramoDe = (d, h) => tramos.value.find(t => t.dia_semana === d && t.hora_num === h)

const cursoCorto = (c) => !c ? '' : c.nombre.includes('PRIMARIA') ? c.nombre.replace(' PRIMARIA', 'ºP')
  : c.nombre.includes('ESO') ? c.nombre.replace(' ESO', 'ºESO') : c.nombre.replace(' AÑOS', ' años')
const cursosAgrupados = computed(() => [
  { titulo: 'Infantil', lista: cursos.value.filter(c => c.etapa === 'INFANTIL') },
  { titulo: 'Primaria', lista: cursos.value.filter(c => c.etapa === 'PRIMARIA') },
  { titulo: 'ESO', lista: cursos.value.filter(c => c.etapa === 'SECUNDARIA') }
])
const etapaProf = (pid) => clases.value.some(c => c.profesor_id === pid && cursoPorId.value[c.curso_id]?.etapa === 'SECUNDARIA') ? 'SECUNDARIA' : 'PRIMARIA'
const hora = (h, pid) => horaRango(h, etapaProf(pid)) || ''

// Un "refuerzo" = un profesor, a una hora, con uno o varios cursos
const grupos = computed(() => {
  const m = new Map()
  clases.value.filter(c => c.asignatura_id === rp.value?.id && c.profesor_id).forEach(c => {
    const k = `${c.profesor_id}|${c.tramo_id}`
    if (!m.has(k)) m.set(k, { key: k, profesor_id: c.profesor_id, tramo_id: c.tramo_id, tramo: tramoPorId.value[c.tramo_id], cursosIds: [] })
    if (c.curso_id) m.get(k).cursosIds.push(c.curso_id)
  })
  return [...m.values()]
})
const textoCursos = (g) => g.cursosIds.map(id => cursoLargo(cursoPorId.value[id])).join(' y ') || 'sin curso'
const nRefuerzosDia = (d) => grupos.value.filter(g => g.tramo.dia_semana === d).length
const porDiaHora = (d, h) => grupos.value.filter(g => g.tramo.dia_semana === d && g.tramo.hora_num === h)
  .sort((a, b) => profPorId.value[a.profesor_id].nombre.localeCompare(profPorId.value[b.profesor_id].nombre))

const profesConRefuerzo = computed(() => profesores.value.filter(p => grupos.value.some(g => g.profesor_id === p.id)))
const cursosConRefuerzo = computed(() => cursos.value.filter(c => grupos.value.some(g => g.cursosIds.includes(c.id))))
const gruposDeProfe = (pid, d) => grupos.value.filter(g => g.profesor_id === pid && g.tramo.dia_semana === d).sort((a, b) => a.tramo.hora_num - b.tramo.hora_num)
const gruposDeCurso = (cid, d) => grupos.value.filter(g => g.cursosIds.includes(cid) && g.tramo.dia_semana === d).sort((a, b) => a.tramo.hora_num - b.tramo.hora_num)
const totalProfe = (pid) => grupos.value.filter(g => g.profesor_id === pid).length
const totalCurso = (cid) => grupos.value.filter(g => g.cursosIds.includes(cid)).length

// ---------- edición ----------
// modal: { modo:'editar'|'nuevo', profesor_id, dia, hora, sel:Set, hayDatos }
const guardando = ref(false)

const abrirEditar = (g) => {
  modal.value = { modo: 'editar', profesor_id: g.profesor_id, dia: g.tramo.dia_semana, hora: g.tramo.hora_num, sel: new Set(g.cursosIds) }
}
const abrirNuevo = (d, h) => { modal.value = { modo: 'nuevo', profesor_id: null, dia: d, hora: h, sel: new Set() } }
const toggle = (id) => { const s = new Set(modal.value.sel); s.has(id) ? s.delete(id) : s.add(id); modal.value = { ...modal.value, sel: s } }

const sustituye = (asigId) => { const a = asigPorId.value[asigId]; return !!a && (a.sustituye ?? a.codigo === 'GUARDIA') }
const textoFilas = (filas) => {
  const a = asigPorId.value[filas[0]?.asignatura_id]?.nombre || '?'
  const cs = filas.map(f => cursoCorto(cursoPorId.value[f.curso_id])).filter(Boolean)
  return a + (cs.length ? ' ' + cs.join(' · ') : '')
}
// quién puede entrar a dar refuerzo en esa hora
const candidatos = computed(() => {
  if (modal.value?.modo !== 'nuevo') return []
  const t = tramoDe(modal.value.dia, modal.value.hora)
  const orden = { libre: 0, cambia: 1, ocupado: 2 }
  return profesores.value.map(p => {
    const filas = clases.value.filter(c => c.profesor_id === p.id && c.tramo_id === t.id)
    let tipo = 'libre', texto = 'Libre'
    if (filas.length && filas[0].asignatura_id === rp.value?.id) { tipo = 'ocupado'; texto = 'Ya da refuerzo' }
    else if (filas.length && sustituye(filas[0].asignatura_id)) { tipo = 'cambia'; texto = `Deja su ${asigPorId.value[filas[0].asignatura_id]?.nombre}` }
    else if (filas.length) { tipo = 'ocupado'; texto = textoFilas(filas) }
    else if (modal.value.hora === 1 && etapaProf(p.id) !== 'SECUNDARIA') { tipo = 'ocupado'; texto = 'Aún no ha entrado' }
    else if (!clases.value.some(c => c.profesor_id === p.id)) { tipo = 'ocupado'; texto = 'Sin horario' }
    return { p, tipo, texto, filas }
  }).sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.p.nombre.localeCompare(b.p.nombre))
})

// info: quién más refuerza ya ese curso a esa hora (se quedan: un refuerzo no quita a otro)
const yaReforzando = computed(() => {
  if (!modal.value) return []
  const t = tramoDe(modal.value.dia, modal.value.hora)
  const res = []
  for (const cid of modal.value.sel) {
    const otros = grupos.value.filter(g => g.tramo_id === t.id && g.cursosIds.includes(cid) && g.profesor_id !== modal.value.profesor_id)
    otros.forEach(g => res.push(`${cursoCorto(cursoPorId.value[cid])} ya tiene refuerzo con ${profPorId.value[g.profesor_id].nombre} (se queda)`))
  }
  return res
})

async function guardar() {
  const m = modal.value
  if (!m.profesor_id) return fallo({ message: 'Elige primero el profesor' })
  if (!m.sel.size) return fallo({ message: 'Elige al menos un curso' })
  const t = tramoDe(m.dia, m.hora)
  guardando.value = true
  try {
    // sustituye lo que tenga ese profesor en esa hora (su refuerzo anterior o la guardia/coordinación que deja)
    const d = await supabase.from('clases').delete().eq('profesor_id', m.profesor_id).eq('tramo_id', t.id)
    if (d.error) throw d.error
    const i = await supabase.from('clases').insert([...m.sel].map(cid => ({
      profesor_id: m.profesor_id, tramo_id: t.id, asignatura_id: rp.value.id, curso_id: cid, es_media_hora: false })))
    if (i.error) throw i.error
    await cargar(); modal.value = null; toast('Guardado ✓')
  } catch (e) { fallo(e) }
  guardando.value = false
}
async function quitar() {
  const m = modal.value
  if (!confirm(`¿Quitar el refuerzo de ${profPorId.value[m.profesor_id].nombre} (${dias[m.dia - 1].nombre} ${m.hora}ª)? Esa hora quedará libre.`)) return
  const t = tramoDe(m.dia, m.hora)
  const d = await supabase.from('clases').delete().eq('profesor_id', m.profesor_id).eq('tramo_id', t.id).eq('asignatura_id', rp.value.id)
  if (d.error) return fallo(d.error)
  await cargar(); modal.value = null; toast('Refuerzo quitado')
}
const elegirProfe = (c) => { if (c.tipo !== 'ocupado') modal.value = { ...modal.value, profesor_id: c.p.id } }
</script>

<template>
  <div class="max-w-xl mx-auto md:max-w-5xl font-sans text-zinc-900">

    <header class="mb-6">
      <h1 class="text-3xl font-black tracking-tight">Refuerzos</h1>
      <p class="text-zinc-600 font-semibold mt-1">Profesores que dan refuerzo, y a qué curso</p>
    </header>

    <!-- Tres formas de verlo -->
    <div class="grid grid-cols-3 gap-2 mb-2">
      <button v-for="v in [['dia','Día'],['profesor','Profesor'],['curso','Curso']]" :key="v[0]" @click="vista = v[0]"
        :class="['h-14 rounded-full text-base font-black transition-colors',
          vista === v[0] ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-700 active:bg-zinc-100']">{{ v[1] }}</button>
    </div>
    <p class="text-base font-semibold text-zinc-600 mb-6 px-1">
      <template v-if="vista === 'dia'">Elige un día: verás, hora a hora, quién da refuerzo.</template>
      <template v-else-if="vista === 'profesor'">La semana de cada profesor que da refuerzo.</template>
      <template v-else>Qué profesores refuerzan a cada curso.</template>
    </p>

    <p v-if="cargando" class="text-center py-12 font-bold animate-pulse">Cargando…</p>
    <p v-else-if="!rp" class="text-center py-12 font-bold text-red-700">No existe la materia «RP» (Refuerzo pedagógico).</p>

    <!-- ============ POR DÍA ============ -->
    <div v-else-if="vista === 'dia'" class="space-y-5">
      <div class="grid grid-cols-5 gap-2">
        <button v-for="d in dias" :key="d.id" @click="dia = d.id"
          :class="['rounded-full py-2 flex flex-col items-center leading-tight transition-colors',
            dia === d.id ? 'bg-yellow-400 text-zinc-950' : 'bg-white border border-zinc-200 text-zinc-700 active:bg-zinc-100']">
          <span class="text-base font-black"><span class="md:hidden">{{ d.nombre.slice(0, 3) }}</span><span class="hidden md:inline">{{ d.nombre }}</span></span>
          <span class="text-xs font-bold opacity-80">{{ nRefuerzosDia(d.id) }}</span>
        </button>
      </div>

      <h2 class="text-xl font-black">{{ dias[dia - 1].nombre }}</h2>

      <div class="space-y-4">
        <template v-for="h in horas" :key="h">
          <Recreo v-if="h === 4" />
          <section class="bg-white rounded-3xl border border-zinc-200 shadow-sm p-4">
            <div class="flex items-baseline gap-3 mb-3">
              <span class="text-2xl font-black">{{ h }}ª hora</span>
              <span class="text-sm font-bold text-zinc-600">{{ horaRango(h, h === 1 ? 'SECUNDARIA' : 'PRIMARIA') }}</span>
            </div>

            <div v-if="porDiaHora(dia, h).length" class="space-y-2.5">
              <div v-for="g in porDiaHora(dia, h)" :key="g.key" class="flex items-center gap-3 bg-yellow-50 rounded-2xl p-3 pl-4 border-l-[6px] border-yellow-400">
                <div class="flex-1 min-w-0">
                  <p class="text-lg font-black leading-tight">{{ profPorId[g.profesor_id].nombre }}</p>
                  <p class="flex flex-wrap items-center gap-1.5 mt-1">
                    <span class="text-sm font-bold text-zinc-600">Refuerza a</span>
                    <span v-for="id in g.cursosIds" :key="id" class="bg-yellow-300 text-zinc-950 text-base font-black rounded-full px-3 py-0.5">{{ cursoLargo(cursoPorId[id]) }}</span>
                  </p>
                </div>
                <button @click="abrirEditar(g)" class="shrink-0 h-12 px-4 rounded-full bg-white border border-zinc-300 font-black text-base active:bg-zinc-100">Cambiar</button>
              </div>
            </div>
            <p v-else class="text-base font-semibold text-zinc-500 mb-1">Nadie da refuerzo esta hora.</p>

            <button @click="abrirNuevo(dia, h)" class="mt-3 w-full h-12 rounded-full border-2 border-dashed border-zinc-300 text-zinc-600 font-black text-base active:bg-zinc-50"><span class="inline-flex items-center gap-2"><Icono name="mas" :size="20" :stroke="2.5" />Añadir un refuerzo</span></button>
          </section>
        </template>
      </div>
    </div>

    <!-- ============ POR PROFESOR ============ -->
    <div v-else-if="vista === 'profesor'" class="grid gap-4 md:grid-cols-2">
      <section v-for="p in profesConRefuerzo" :key="p.id" class="bg-white rounded-3xl border border-zinc-200 shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xl font-black">{{ p.nombre }}</h3>
          <span class="text-sm font-black bg-yellow-100 text-yellow-900 rounded-full px-3 py-1">{{ totalProfe(p.id) }} horas</span>
        </div>
        <div v-for="d in dias" :key="d.id" class="py-3 border-t border-zinc-100">
          <p class="text-sm font-black text-zinc-600 mb-1.5">{{ d.nombre }}</p>
          <div v-if="gruposDeProfe(p.id, d.id).length" class="flex flex-col gap-2">
            <button v-for="g in gruposDeProfe(p.id, d.id)" :key="g.key" @click="abrirEditar(g)"
              class="text-left bg-yellow-50 border-l-[6px] border-yellow-400 rounded-2xl pl-4 pr-3 py-2.5 active:bg-yellow-100">
              <span class="text-base font-black">{{ g.tramo.hora_num }}ª hora</span>
              <span class="text-base font-bold text-zinc-700"> · {{ textoCursos(g) }}</span>
            </button>
          </div>
          <p v-else class="text-base font-semibold text-zinc-300">—</p>
        </div>
      </section>
    </div>

    <!-- ============ POR CURSO ============ -->
    <div v-else class="grid gap-4 md:grid-cols-2">
      <section v-for="c in cursosConRefuerzo" :key="c.id" class="bg-white rounded-3xl border border-zinc-200 shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xl font-black">{{ cursoLargo(c) }}</h3>
          <span class="text-sm font-black bg-yellow-100 text-yellow-900 rounded-full px-3 py-1">{{ totalCurso(c.id) }} refuerzos</span>
        </div>
        <div v-for="d in dias" :key="d.id" class="py-3 border-t border-zinc-100">
          <p class="text-sm font-black text-zinc-600 mb-1.5">{{ d.nombre }}</p>
          <div v-if="gruposDeCurso(c.id, d.id).length" class="flex flex-col gap-2">
            <button v-for="g in gruposDeCurso(c.id, d.id)" :key="g.key" @click="abrirEditar(g)"
              class="text-left bg-yellow-50 border-l-[6px] border-yellow-400 rounded-2xl pl-4 pr-3 py-2.5 active:bg-yellow-100">
              <span class="text-base font-black">{{ g.tramo.hora_num }}ª hora</span>
              <span class="text-base font-bold text-zinc-700"> · {{ profPorId[g.profesor_id].nombre }}</span>
            </button>
          </div>
          <p v-else class="text-base font-semibold text-zinc-300">—</p>
        </div>
      </section>
    </div>

    <!-- ============ VENTANA PARA CAMBIAR ============ -->
    <div v-if="modal" class="fixed inset-0 z-[60] bg-black/50 flex items-end md:items-center justify-center" @click.self="modal = null">
      <div class="bg-white w-full md:max-w-xl rounded-t-3xl md:rounded-3xl px-5 pt-5 pb-modal max-h-[88dvh] overflow-y-auto modal-scroll space-y-5">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-black text-zinc-600">{{ modal.modo === 'nuevo' ? 'Nuevo refuerzo' : 'Cambiar refuerzo' }}</p>
            <h2 class="text-2xl font-black leading-tight">
              {{ modal.profesor_id ? profPorId[modal.profesor_id].nombre : '' }}
            </h2>
            <p class="text-base font-bold text-zinc-600">{{ dias[modal.dia - 1].nombre }} · {{ modal.hora }}ª hora</p>
          </div>
          <button @click="modal = null" class="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center"><Icono name="cerrar" :size="22" /></button>
        </div>

        <div v-if="modal.modo === 'nuevo'">
          <p class="text-base font-black mb-2">1. ¿Quién da el refuerzo?</p>
          <div class="grid gap-2 max-h-64 overflow-y-auto modal-scroll">
            <button v-for="c in candidatos" :key="c.p.id" :disabled="c.tipo === 'ocupado'" @click="elegirProfe(c)"
              :class="['flex items-center justify-between gap-2 text-left rounded-2xl border-2 px-4 py-3 disabled:opacity-60',
                modal.profesor_id === c.p.id ? 'ring-2 ring-zinc-900' : '',
                c.tipo === 'libre' ? 'bg-emerald-50 border-emerald-300' : c.tipo === 'cambia' ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-200']">
              <span class="font-black text-base">{{ c.p.nombre }}</span>
              <span class="text-sm font-bold text-zinc-700 text-right">{{ c.texto }}</span>
            </button>
          </div>
        </div>

        <div>
          <p class="text-base font-black mb-2">{{ modal.modo === 'nuevo' ? '2. ' : '' }}¿A qué curso refuerza? <span class="font-semibold text-zinc-600">(puedes marcar varios)</span></p>
          <div v-for="g in cursosAgrupados" :key="g.titulo" class="mb-3">
            <p class="text-sm font-black text-zinc-600 mb-1.5">{{ g.titulo }}</p>
            <div class="flex flex-wrap gap-2">
              <button v-for="c in g.lista" :key="c.id" @click="toggle(c.id)"
                :class="['h-12 px-5 rounded-full text-base font-black transition-colors',
                  modal.sel.has(c.id) ? 'bg-yellow-400 text-zinc-950' : 'bg-zinc-100 text-zinc-800 active:bg-zinc-200']">
                <span class="inline-flex items-center gap-1.5"><Icono v-if="modal.sel.has(c.id)" name="check" :size="18" :stroke="3" />{{ cursoLargo(c) }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-if="yaReforzando.length" class="bg-sky-50 rounded-2xl p-4 text-base font-semibold text-sky-900 space-y-1">
          <p v-for="t in yaReforzando" :key="t" class="flex items-start gap-2"><Icono name="info" :size="20" class="mt-0.5" /><span>{{ t }}</span></p>
        </div>

        <div class="flex gap-3">
          <button v-if="modal.modo === 'editar'" @click="quitar" class="h-14 px-6 rounded-full font-black text-base text-red-700 bg-red-50">Quitar</button>
          <button @click="guardar" :disabled="guardando" class="flex-1 h-14 rounded-full font-black text-lg bg-zinc-900 text-white disabled:opacity-50">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="aviso" class="toast-pos fixed left-1/2 -translate-x-1/2 z-[70] bg-zinc-900 text-white font-black text-base px-6 py-3.5 rounded-full shadow-lg">{{ aviso }}</div>
    <div v-if="errorMsg" class="toast-pos fixed left-4 right-4 z-[70] bg-red-600 text-white font-bold text-base px-5 py-3.5 rounded-3xl shadow-lg">{{ errorMsg }}</div>
  </div>
</template>
