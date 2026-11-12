<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const supabase = useSupabaseClient()

// Con la ventana abierta, el fondo no debe moverse (iPhone)
const modal = ref(null)
watch(modal, (v) => { if (import.meta.client) document.body.style.overflow = v ? 'hidden' : '' })
onBeforeUnmount(() => { if (import.meta.client) document.body.style.overflow = '' })

const tab = ref('horarios')            // horarios | profesores | materias
const cargando = ref(true)
const aviso = ref('')
const errorMsg = ref('')

const profesores = ref([])
const cursos = ref([])
const asignaturas = ref([])
const tramos = ref([])
const clases = ref([])                 // todas: {id, profesor_id, curso_id, asignatura_id, tramo_id}

const dias = [
  { id: 1, nombre: 'Lunes', corto: 'L' }, { id: 2, nombre: 'Martes', corto: 'M' },
  { id: 3, nombre: 'Miércoles', corto: 'X' }, { id: 4, nombre: 'Jueves', corto: 'J' },
  { id: 5, nombre: 'Viernes', corto: 'V' }
]
const horas = [1, 2, 3, 4, 5, 6]

const profId = ref(null)
const diaMovil = ref(1)

const toast = (msg) => { aviso.value = msg; setTimeout(() => { if (aviso.value === msg) aviso.value = '' }, 2200) }
const fallo = (e) => { console.error(e); errorMsg.value = e?.message || 'Error al guardar'; setTimeout(() => (errorMsg.value = ''), 5000) }

async function cargarTodo() {
  const [p, c, a, t, cl] = await Promise.all([
    supabase.from('profesores').select('*').order('nombre'),
    supabase.from('cursos').select('*').order('id'),
    supabase.from('asignaturas').select('*').order('nombre'),
    supabase.from('tramos_horarios').select('*'),
    supabase.from('clases').select('id, profesor_id, curso_id, asignatura_id, tramo_id, nota').limit(5000)
  ])
  const err = p.error || c.error || a.error || t.error || cl.error
  if (err) return fallo(err)
  profesores.value = p.data; cursos.value = c.data; asignaturas.value = a.data
  tramos.value = t.data; clases.value = cl.data
  if (!profId.value && p.data.length) profId.value = p.data[0].id
}
onMounted(async () => { await cargarTodo(); cargando.value = false })

// ---------- helpers ----------
const tramoDe = (dia, hora) => tramos.value.find(t => t.dia_semana === dia && t.hora_num === hora)
const asigPorId = computed(() => Object.fromEntries(asignaturas.value.map(a => [a.id, a])))
const cursoPorId = computed(() => Object.fromEntries(cursos.value.map(c => [c.id, c])))
const profPorId = computed(() => Object.fromEntries(profesores.value.map(p => [p.id, p])))
const cursoCorto = (c) => {
  if (!c) return ''
  const n = c.nombre
  if (n.includes('PRIMARIA')) return n.replace(' PRIMARIA', 'ºP')
  if (n.includes('ESO')) return n.replace(' ESO', 'ºESO')
  return n.replace(' AÑOS', ' años')
}
const cursosAgrupados = computed(() => [
  { titulo: 'Infantil', lista: cursos.value.filter(c => c.etapa === 'INFANTIL') },
  { titulo: 'Primaria', lista: cursos.value.filter(c => c.etapa === 'PRIMARIA') },
  { titulo: 'ESO', lista: cursos.value.filter(c => c.etapa === 'SECUNDARIA') }
])

const sustituye = (asigId) => { const a = asigPorId.value[asigId]; return !!a && (a.sustituye ?? a.codigo === 'GUARDIA') }
const esApoyo = (asigId) => CODIGOS_APOYO.includes(asigPorId.value[asigId]?.codigo)
const diaNombre = (d) => dias[d - 1].nombre
const textoFilas = (filas) => {
  if (!filas.length) return ''
  const cs = filas.map(f => cursoCorto(cursoPorId.value[f.curso_id])).filter(Boolean)
  return `${asigPorId.value[filas[0].asignatura_id]?.nombre || '?'}${cs.length ? ' ' + cs.join(' · ') : ''}`
}
// Entra a las 8:00 si da clase a ESO, si no a las 9:00
const etapaProf = (pid) => clases.value.some(c => c.profesor_id === pid && cursoPorId.value[c.curso_id]?.etapa === 'SECUNDARIA') ? 'SECUNDARIA' : 'PRIMARIA'
const rangoHora = (h) => horaRango(h, etapaProf(profId.value)) || '9:00'

const celdaDe = (dia, hora) => {
  const t = tramoDe(dia, hora)
  if (!t) return []
  return clases.value.filter(c => c.profesor_id === profId.value && c.tramo_id === t.id)
}
// una celda = misma asignatura con varios cursos → se resume en una sola tarjeta
const resumenCelda = (dia, hora) => {
  const filas = celdaDe(dia, hora)
  if (!filas.length) return null
  const asig = asigPorId.value[filas[0].asignatura_id]
  const cs = filas.map(f => cursoPorId.value[f.curso_id]).filter(Boolean).map(cursoCorto)
  return { asig, cursos: cs }
}

// ---------- editor de celda ----------
// modal: { dia, hora, asigId, cursosSel:Set, otrosDias:Set }
const abrirCelda = (dia, hora) => {
  const filas = celdaDe(dia, hora)
  modal.value = {
    dia, hora,
    asigId: filas[0]?.asignatura_id ?? null,
    cursosSel: new Set(filas.map(f => f.curso_id).filter(Boolean)),
    otrosDias: new Set(),
    hayDatos: filas.length > 0,
    pasando: false,
    destino: null
  }
}
const toggleSet = (set, v) => { set.has(v) ? set.delete(v) : set.add(v); modal.value = { ...modal.value } }

// avisos de choque: ese curso ya tiene clase con OTRO profesor a esa hora (en el día elegido y en los repetidos)
const choques = computed(() => {
  if (!modal.value) return []
  const res = []
  for (const d of [modal.value.dia, ...modal.value.otrosDias]) {
    const t = tramoDe(d, modal.value.hora)
    for (const cid of modal.value.cursosSel) {
      const curso = cursoPorId.value[cid]
      if (modal.value.hora === 1 && curso?.etapa !== 'SECUNDARIA') {
        res.push(`${cursoCorto(curso)} no tiene clase a 1ª hora (empiezan a las 9:00) · ${diaNombre(d)}`)
      }
      if (modal.value.asigId && esApoyo(modal.value.asigId)) continue // un apoyo puede coincidir con el tutor
      const otros = clases.value.filter(c => c.tramo_id === t?.id && c.curso_id === cid && c.profesor_id !== profId.value && !esApoyo(c.asignatura_id))
      for (const o of otros) {
        res.push(`${cursoCorto(curso)} ya tiene ${asigPorId.value[o.asignatura_id]?.nombre || '?'} con ${profPorId.value[o.profesor_id]?.nombre || '?'} · ${diaNombre(d)}`)
      }
    }
  }
  return [...new Set(res)]
})
// al repetir en otros días se sustituye lo que haya en esos huecos: lo avisamos
const pisados = computed(() => {
  if (!modal.value) return []
  return [...modal.value.otrosDias].map(d => ({ d, filas: celdaDe(d, modal.value.hora) }))
    .filter(x => x.filas.length).map(x => `${diaNombre(x.d)}: se sustituye ${textoFilas(x.filas)}`)
})

// ---------- pasar la clase a otro profesor ----------
const candidatos = computed(() => {
  if (!modal.value?.pasando) return []
  const t = tramoDe(modal.value.dia, modal.value.hora)
  const orden = { libre: 0, guardia: 1, ocupado: 2, fuera: 3 }
  return profesores.value.filter(p => p.id !== profId.value).map(p => {
    const filas = clases.value.filter(c => c.profesor_id === p.id && c.tramo_id === t.id)
    let tipo = 'libre', texto = 'Libre'
    if (filas.length && sustituye(filas[0].asignatura_id)) { tipo = 'guardia'; texto = 'Tiene guardia (la perdería)' }
    else if (filas.length) { tipo = 'ocupado'; texto = textoFilas(filas) }
    else if (modal.value.hora === 1 && etapaProf(p.id) !== 'SECUNDARIA') { tipo = 'fuera'; texto = 'Aún no ha entrado (9:00)' }
    return { p, tipo, texto, filas }
  }).sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.p.nombre.localeCompare(b.p.nombre))
})
const destinoSel = computed(() => candidatos.value.find(c => c.p.id === modal.value?.destino))

async function pasarClase() {
  const m = modal.value, d = destinoSel.value
  if (!d) return
  const mias = celdaDe(m.dia, m.hora)
  const misIds = mias.map(c => c.id), susIds = d.filas.map(c => c.id)
  const msg = d.tipo === 'ocupado'
    ? `¿Intercambiar?\n• ${profPorId.value[profId.value].nombre} pasa a: ${textoFilas(d.filas)}\n• ${d.p.nombre} pasa a: ${textoFilas(mias)}`
    : d.tipo === 'guardia'
      ? `¿Pasar ${textoFilas(mias)} a ${d.p.nombre}? Perderá su guardia a esa hora.`
      : `¿Pasar ${textoFilas(mias)} a ${d.p.nombre}?`
  if (!confirm(msg)) return
  guardando.value = true
  try {
    if (d.tipo === 'guardia') { const r = await supabase.from('clases').delete().in('id', susIds); if (r.error) throw r.error }
    const r1 = await supabase.from('clases').update({ profesor_id: d.p.id }).in('id', misIds)
    if (r1.error) throw r1.error
    if (d.tipo === 'ocupado') { const r2 = await supabase.from('clases').update({ profesor_id: profId.value }).in('id', susIds); if (r2.error) throw r2.error }
    await cargarTodo(); modal.value = null
    toast(d.tipo === 'ocupado' ? 'Intercambio hecho ✓' : `Pasada a ${d.p.nombre} ✓`)
  } catch (e) { fallo(e) }
  guardando.value = false
}

async function escribirCelda(dia, hora, asigId, cursosIds) {
  const t = tramoDe(dia, hora)
  const del = await supabase.from('clases').delete().eq('profesor_id', profId.value).eq('tramo_id', t.id)
  if (del.error) throw del.error
  if (!asigId) return
  const filas = (cursosIds.length ? cursosIds : [null]).map(cid => ({
    profesor_id: profId.value, tramo_id: t.id, asignatura_id: asigId, curso_id: cid, es_media_hora: false
  }))
  const ins = await supabase.from('clases').insert(filas)
  if (ins.error) throw ins.error
}

const guardando = ref(false)
async function guardarCelda() {
  const m = modal.value
  if (!m.asigId) return fallo({ message: 'Elige primero qué materia es' })
  guardando.value = true
  try {
    const ids = [...m.cursosSel]
    await escribirCelda(m.dia, m.hora, m.asigId, ids)
    for (const d of m.otrosDias) await escribirCelda(d, m.hora, m.asigId, ids)
    await cargarTodo()
    modal.value = null
    toast('Guardado ✓')
  } catch (e) { fallo(e) }
  guardando.value = false
}
async function vaciarCelda() {
  guardando.value = true
  try {
    await escribirCelda(modal.value.dia, modal.value.hora, null, [])
    await cargarTodo(); modal.value = null; toast('Hueco vaciado')
  } catch (e) { fallo(e) }
  guardando.value = false
}

// ---------- revisión de problemas ----------
const problemas = computed(() => {
  const res = []
  const nombreTramo = (t) => `${diaNombre(t.dia_semana)} ${t.hora_num}ª`
  const ir = (profesor_id, t) => ({ profesor_id, dia: t.dia_semana, hora: t.hora_num })
  // 1. un curso con dos profesores dando clase (no apoyo) a la vez
  const porCursoTramo = {}
  clases.value.filter(c => c.curso_id && !esApoyo(c.asignatura_id)).forEach(c => ((porCursoTramo[`${c.curso_id}|${c.tramo_id}`] ??= []).push(c)))
  for (const [k, g] of Object.entries(porCursoTramo)) {
    const profs = [...new Set(g.map(c => c.profesor_id))]
    if (profs.length < 2 || cursoPorId.value[g[0].curso_id]?.etapa === 'INFANTIL') continue
    const t = tramos.value.find(x => x.id === g[0].tramo_id)
    res.push({ gravedad: 'alta', titulo: `${cursoCorto(cursoPorId.value[g[0].curso_id])} · ${nombreTramo(t)}: ${profs.length} profesores a la vez`,
      detalle: g.map(c => `${profPorId.value[c.profesor_id]?.nombre} (${asigPorId.value[c.asignatura_id]?.nombre})`).join(' + '), ir: ir(profs[0], t) })
  }
  // 2. un profesor con dos materias distintas en la misma hora
  const porProfTramo = {}
  clases.value.filter(c => c.profesor_id).forEach(c => ((porProfTramo[`${c.profesor_id}|${c.tramo_id}`] ??= []).push(c)))
  for (const g of Object.values(porProfTramo)) {
    if (new Set(g.map(c => c.asignatura_id)).size < 2) continue
    const t = tramos.value.find(x => x.id === g[0].tramo_id)
    res.push({ gravedad: 'alta', titulo: `${profPorId.value[g[0].profesor_id]?.nombre} · ${nombreTramo(t)}: dos cosas a la vez`,
      detalle: g.map(c => asigPorId.value[c.asignatura_id]?.nombre).join(' + '), ir: ir(g[0].profesor_id, t) })
  }
  // 3. Primaria/Infantil con clase a 1ª hora (empiezan a las 9:00)
  clases.value.filter(c => c.curso_id && cursoPorId.value[c.curso_id]?.etapa !== 'SECUNDARIA').forEach(c => {
    const t = tramos.value.find(x => x.id === c.tramo_id)
    if (t?.hora_num === 1) res.push({ gravedad: 'alta', titulo: `${cursoCorto(cursoPorId.value[c.curso_id])} · ${nombreTramo(t)}: clase antes de las 9:00`,
      detalle: `${profPorId.value[c.profesor_id]?.nombre} · ${asigPorId.value[c.asignatura_id]?.nombre}`, ir: ir(c.profesor_id, t) })
  })
  // 4. horas de ESO/Primaria en las que ningún profesor atiende al curso
  for (const cu of cursos.value.filter(c => c.etapa !== 'INFANTIL')) {
    for (const t of tramos.value) {
      if (t.hora_num === 1 && cu.etapa !== 'SECUNDARIA') continue
      if (!clases.value.some(c => c.curso_id === cu.id && c.tramo_id === t.id))
        res.push({ gravedad: 'media', titulo: `${cursoCorto(cu)} · ${nombreTramo(t)}: ningún profesor`, detalle: 'Hueco sin cubrir en el horario del curso', ir: null, orden: t.id })
    }
  }
  // 5. sin móvil
  profesores.value.filter(p => !p.telefono).forEach(p => res.push({ gravedad: 'baja', titulo: `${p.nombre}: sin móvil`, detalle: 'No se le podrá avisar por WhatsApp', tab: 'profesores' }))
  return res
})

// ---------- profesores ----------
const irA = ({ profesor_id, dia, hora }) => {
  tab.value = 'horarios'; profId.value = profesor_id; diaMovil.value = dia
  abrirCelda(dia, hora)
}
const nuevoProf = ref('')
async function guardarProf(p, campo) {
  let valor = p[campo]
  if (campo === 'telefono') {
    valor = (valor || '').replace(/[^\d]/g, '')
    if (valor && valor.length === 9) valor = '34' + valor
    p.telefono = valor
  }
  const { error } = await supabase.from('profesores').update({ [campo]: valor || null }).eq('id', p.id)
  error ? fallo(error) : toast('Guardado ✓')
}
async function añadirProf() {
  const nombre = nuevoProf.value.trim()
  if (!nombre) return
  const { error } = await supabase.from('profesores').insert({ nombre })
  if (error) return fallo(error)
  nuevoProf.value = ''; await cargarTodo(); toast('Profesor añadido')
}
async function borrarProf(p) {
  const n = clases.value.filter(c => c.profesor_id === p.id).length
  if (!confirm(`¿Borrar a ${p.nombre}${n ? ` y sus ${n} clases` : ''}?`)) return
  await supabase.from('clases').delete().eq('profesor_id', p.id)
  const { error } = await supabase.from('profesores').delete().eq('id', p.id)
  if (error) return fallo(error)
  if (profId.value === p.id) profId.value = null
  await cargarTodo(); toast('Borrado')
}
const telefonoBonito = (t) => t ? '+' + t.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4') : ''

// ---------- materias ----------
const nuevaAsig = ref('')
async function guardarAsig(a, campo) {
  const { error } = await supabase.from('asignaturas').update({ [campo]: a[campo] }).eq('id', a.id)
  error ? fallo(error) : toast('Guardado ✓')
}
async function añadirAsig() {
  const nombre = nuevaAsig.value.trim()
  if (!nombre) return
  const codigo = nombre.toUpperCase().replace(/\s+/g, '').slice(0, 8)
  const { error } = await supabase.from('asignaturas').insert({ codigo, nombre, color_hex: '#3B82F6' })
  if (error) return fallo(error)
  nuevaAsig.value = ''; await cargarTodo(); toast('Materia añadida')
}
async function borrarAsig(a) {
  const n = clases.value.filter(c => c.asignatura_id === a.id).length
  if (n) return fallo({ message: `"${a.nombre}" se usa en ${n} clases. Cámbialas antes de borrarla.` })
  if (!confirm(`¿Borrar la materia ${a.nombre}?`)) return
  const { error } = await supabase.from('asignaturas').delete().eq('id', a.id)
  error ? fallo(error) : (await cargarTodo(), toast('Borrada'))
}
const usos = (a) => clases.value.filter(c => c.asignatura_id === a.id).length
</script>

<template>
  <div class="max-w-xl mx-auto px-0 py-0 font-sans text-zinc-900 md:max-w-6xl">
    <header class="mb-6">
      <div class="">
        <h1 class="text-3xl font-black tracking-tight">Editar datos</h1>
        <p class="text-zinc-600 font-semibold text-sm mt-1">Cambia horarios, teléfonos y materias. Se guarda al momento.</p>
      </div>
    </header>

    <div class="grid grid-cols-4 gap-1.5 mb-6">
      <button v-for="t in [['horarios','Horarios'],['revision','Revisión'],['profesores','Profes'],['materias','Materias']]" :key="t[0]"
        @click="tab = t[0]"
        :class="['py-3 rounded-full text-xs font-black uppercase tracking-wider border-2 transition-all',
          tab === t[0] ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200']">
        {{ t[1] }}<span v-if="t[0] === 'revision' && problemas.filter(x => x.gravedad !== 'baja').length" class="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-xs">{{ problemas.filter(x => x.gravedad !== 'baja').length }}</span>
      </button>
    </div>

    <p v-if="cargando" class="text-center py-12 font-bold text-zinc-700 animate-pulse">Cargando…</p>

    <!-- ================= HORARIOS ================= -->
    <div v-else-if="tab === 'horarios'" class="space-y-5">
      <div>
        <label class="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">Profesor/a</label>
        <select v-model="profId"
          class="w-full bg-white border-2 border-zinc-300 font-black rounded-2xl px-5 py-4 text-lg focus:border-zinc-900 focus:outline-none">
          <option v-for="p in profesores" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
        <p class="text-xs font-bold text-zinc-600 mt-2">Toca cualquier hueco para cambiarlo o rellenarlo. Los cursos se actualizan solos.</p>
      </div>

      <!-- días (móvil) -->
      <div class="grid grid-cols-5 gap-1.5 md:hidden">
        <button v-for="d in dias" :key="d.id" @click="diaMovil = d.id"
          :class="['py-3 rounded-full font-black text-sm border-2', diaMovil === d.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700']">
          {{ d.corto }}
        </button>
      </div>

      <div class="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div class="hidden md:grid grid-cols-[60px_repeat(5,1fr)] bg-zinc-100 border-b-2 border-zinc-200">
          <div></div>
          <div v-for="d in dias" :key="d.id" class="p-3 text-center text-xs font-black uppercase tracking-wider">{{ d.nombre }}</div>
        </div>
        <div v-for="h in horas" :key="h" class="grid grid-cols-[48px_1fr] md:grid-cols-[60px_repeat(5,1fr)] border-b border-zinc-200 last:border-0">
          <div class="flex flex-col items-center justify-center bg-zinc-50 font-black text-zinc-700 border-r border-zinc-200 leading-tight">
            <span>{{ h }}ª</span><span class="text-xs font-bold text-zinc-600">{{ rangoHora(h).split('–')[0] }}</span>
          </div>
          <template v-for="d in dias" :key="d.id">
            <div :class="['p-1.5 md:border-l border-zinc-200', d.id === diaMovil ? '' : 'hidden md:block']">
              <button type="button" @click="abrirCelda(d.id, h)"
                class="w-full min-h-[64px] md:min-h-[84px] text-left rounded-2xl border-2 p-2.5 transition-all active:scale-[.98]"
                :style="resumenCelda(d.id, h) ? { backgroundColor: (resumenCelda(d.id, h).asig?.color_hex || '#18181b') + '18', borderColor: resumenCelda(d.id, h).asig?.color_hex } : {}"
                :class="resumenCelda(d.id, h) ? '' : 'border-dashed border-zinc-300 bg-zinc-50 hover:border-zinc-500'">
                <template v-if="resumenCelda(d.id, h)">
                  <p class="text-sm font-black leading-tight">{{ resumenCelda(d.id, h).asig?.nombre }}</p>
                  <p class="text-xs font-extrabold text-zinc-700 mt-0.5">{{ resumenCelda(d.id, h).cursos.join(' · ') }}</p>
                </template>
                <span v-else class="text-2xl font-black text-zinc-300 leading-none">+</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ================= REVISIÓN ================= -->
    <div v-else-if="tab === 'revision'" class="space-y-2">
      <p class="text-xs font-bold text-zinc-600 mb-2">Comprobación automática del horario. Toca un aviso para ir directo a arreglarlo.</p>
      <div v-if="!problemas.length" class="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-center font-black text-emerald-900">Todo en orden ✓</div>
      <component :is="pr.ir || pr.tab ? 'button' : 'div'" v-for="(pr, i) in problemas" :key="i" type="button"
        @click="pr.ir ? irA(pr.ir) : pr.tab ? (tab = pr.tab) : null"
        :class="['w-full text-left rounded-2xl border-2 p-3 block',
          pr.gravedad === 'alta' ? 'bg-red-50 border-red-300' : pr.gravedad === 'media' ? 'bg-amber-50 border-amber-300' : 'bg-zinc-50 border-zinc-200']">
        <p class="font-black text-sm">{{ pr.titulo }}</p>
        <p class="text-xs font-semibold text-zinc-600">{{ pr.detalle }}</p>
      </component>
    </div>

    <!-- ================= PROFESORES ================= -->
    <div v-else-if="tab === 'profesores'" class="space-y-3">
      <div v-for="p in profesores" :key="p.id" class="bg-white rounded-3xl border border-zinc-200 shadow-sm p-4 space-y-3">
        <div class="flex items-center gap-2">
          <input v-model="p.nombre" @change="guardarProf(p, 'nombre')"
            class="flex-1 min-w-0 font-black text-lg border-b-2 border-transparent focus:border-zinc-900 focus:outline-none bg-transparent" />
          <button @click="borrarProf(p)" class="text-xs font-black uppercase text-red-600 px-2 py-1">Borrar</button>
        </div>
        <input v-model="p.nombre_completo" @change="guardarProf(p, 'nombre_completo')" placeholder="Nombre completo"
          class="w-full text-sm font-semibold text-zinc-700 bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-200 focus:outline-none focus:border-zinc-900" />
        <div class="flex items-center gap-2">
          <input v-model="p.telefono" @change="guardarProf(p, 'telefono')" inputmode="tel" placeholder="Móvil (ej. 600 123 456)"
            class="flex-1 text-base font-bold bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-200 focus:outline-none focus:border-zinc-900" />
          <span v-if="p.telefono" class="text-xs font-bold text-emerald-700 whitespace-nowrap">{{ telefonoBonito(p.telefono) }}</span>
          <span v-else class="text-xs font-bold text-amber-700">sin móvil</span>
        </div>
        <label class="flex items-center gap-2 text-xs font-extrabold text-zinc-700 cursor-pointer">
          <input type="checkbox" v-model="p.participa_servicios" @change="guardarProf(p, 'participa_servicios')" class="w-4 h-4" />
          Entra en el reparto de servicios (8-9 y 13:30-14:30)
        </label>
      </div>
      <div class="flex gap-2">
        <input v-model="nuevoProf" @keyup.enter="añadirProf" placeholder="Nuevo profesor/a…"
          class="flex-1 bg-white border-2 border-zinc-300 rounded-2xl px-4 py-3 font-bold focus:outline-none focus:border-zinc-900" />
        <button @click="añadirProf" class="bg-zinc-900 text-white font-black rounded-full px-5">Añadir</button>
      </div>
    </div>

    <!-- ================= MATERIAS ================= -->
    <div v-else class="space-y-2">
      <p class="text-xs font-bold text-zinc-600 mb-2">Aquí cambias el nombre y el color de cada materia. Marca «Sustituye» en las que cuentan como guardia: sus profesores saldrán como posibles sustitutos en Ausencias.</p>
      <div v-for="a in asignaturas" :key="a.id" class="bg-white rounded-2xl border-2 border-zinc-200 p-3 flex items-center gap-3">
        <input type="color" v-model="a.color_hex" @change="guardarAsig(a, 'color_hex')" class="w-10 h-10 rounded-lg border-0 p-0 bg-transparent cursor-pointer" />
        <input v-model="a.nombre" @change="guardarAsig(a, 'nombre')"
          class="flex-1 min-w-0 font-black border-b-2 border-transparent focus:border-zinc-900 focus:outline-none bg-transparent" />
        <label class="flex items-center gap-1 text-xs font-extrabold text-zinc-600 whitespace-nowrap cursor-pointer" title="Los profesores con esta materia aparecen como posibles sustitutos en Ausencias">
          <input type="checkbox" v-model="a.sustituye" @change="guardarAsig(a, 'sustituye')" class="w-4 h-4" /> Sustituye
        </label>
        <span class="text-xs font-extrabold text-zinc-600 whitespace-nowrap">{{ usos(a) }} usos</span>
        <button @click="borrarAsig(a)" class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-red-600 active:bg-red-50"><Icono name="cerrar" :size="18" /></button>
      </div>
      <div class="flex gap-2 pt-2">
        <input v-model="nuevaAsig" @keyup.enter="añadirAsig" placeholder="Nueva materia…"
          class="flex-1 bg-white border-2 border-zinc-300 rounded-2xl px-4 py-3 font-bold focus:outline-none focus:border-zinc-900" />
        <button @click="añadirAsig" class="bg-zinc-900 text-white font-black rounded-full px-5">Añadir</button>
      </div>
    </div>

    <!-- ================= MODAL CELDA ================= -->
    <div v-if="modal" class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center" @click.self="modal = null">
      <div class="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl px-5 pt-5 pb-modal max-h-[88dvh] overflow-y-auto modal-scroll space-y-5">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-black uppercase tracking-wider text-zinc-600">{{ profPorId[profId]?.nombre }}</p>
            <h2 class="text-xl font-black">{{ dias[modal.dia - 1].nombre }} · {{ modal.hora }}ª hora</h2>
          </div>
          <button @click="modal = null" class="w-11 h-11 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center"><Icono name="cerrar" :size="22" /></button>
        </div>

        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">1. ¿Qué materia/actividad?</p>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="a in asignaturas" :key="a.id" @click="modal = { ...modal, asigId: a.id }"
              :class="['px-3 py-2 rounded-full text-xs font-black border-2 transition-all',
                modal.asigId === a.id ? 'text-white' : 'bg-white text-zinc-800']"
              :style="{ borderColor: a.color_hex, backgroundColor: modal.asigId === a.id ? a.color_hex : '' }">
              {{ a.nombre }}
            </button>
          </div>
        </div>

        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            2. ¿Con qué curso(s)? <span class="font-bold text-zinc-600 normal-case">(puedes marcar varios o ninguno)</span>
          </p>
          <div v-for="g in cursosAgrupados" :key="g.titulo" class="mb-2">
            <p class="text-xs font-extrabold text-zinc-600 uppercase mb-1">{{ g.titulo }}</p>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="c in g.lista" :key="c.id" @click="toggleSet(modal.cursosSel, c.id)"
                :class="['px-3 py-2 rounded-full text-xs font-black border-2',
                  modal.cursosSel.has(c.id) ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-800 border-zinc-200']">
                {{ cursoCorto(c) }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="choques.length" class="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 text-xs font-bold text-amber-900 space-y-0.5">
          <p class="font-black uppercase tracking-wider flex items-center gap-1.5"><Icono name="aviso" :size="18" /> Ojo, posible choque</p>
          <p v-for="c in choques" :key="c">{{ c }}</p>
        </div>

        <div v-if="pisados.length" class="bg-red-50 border-2 border-red-300 rounded-2xl p-3 text-xs font-bold text-red-900 space-y-0.5">
          <p class="font-black uppercase tracking-wider">Ojo: pisarás lo que ya hay</p>
          <p v-for="c in pisados" :key="c">{{ c }}</p>
        </div>

        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            3. ¿Repetir a la {{ modal.hora }}ª hora otros días? <span class="font-bold text-zinc-600 normal-case">(opcional)</span>
          </p>
          <div class="grid grid-cols-5 gap-1.5">
            <button v-for="d in dias.filter(x => x.id !== modal.dia)" :key="d.id" @click="toggleSet(modal.otrosDias, d.id)"
              :class="['py-2 rounded-full text-xs font-black border-2',
                modal.otrosDias.has(d.id) ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-800 border-zinc-200']">
              {{ d.nombre.slice(0, 3) }}
            </button>
          </div>
        </div>

        <div v-if="modal.hayDatos" class="border-t-2 border-zinc-100 pt-4">
          <button v-if="!modal.pasando" @click="modal = { ...modal, pasando: true }"
            class="w-full py-3 rounded-full font-black text-sm bg-sky-50 text-sky-900 border-2 border-sky-200">
            <span class="inline-flex items-center justify-center gap-2"><Icono name="intercambio" :size="20" /> Pasar esta clase a otro profesor</span>
          </button>
          <div v-else class="space-y-2">
            <p class="text-xs font-black uppercase tracking-wider text-zinc-700">¿A quién se la pasas? <span class="font-bold text-zinc-600 normal-case">(solo se mueve esta hora)</span></p>
            <div class="grid gap-1.5 max-h-64 overflow-y-auto">
              <button v-for="c in candidatos" :key="c.p.id" :disabled="c.tipo === 'fuera'"
                @click="modal = { ...modal, destino: c.p.id }"
                :class="['flex items-center justify-between gap-2 text-left rounded-2xl border-2 px-3 py-2.5 disabled:opacity-60',
                  modal.destino === c.p.id ? 'ring-2 ring-zinc-900' : '',
                  c.tipo === 'libre' ? 'bg-emerald-50 border-emerald-300' : c.tipo === 'guardia' ? 'bg-amber-50 border-amber-300' : c.tipo === 'ocupado' ? 'bg-red-50 border-red-200' : 'bg-zinc-100 border-zinc-200']">
                <span class="font-black text-sm">{{ c.p.nombre }}</span>
                <span class="text-xs font-bold text-zinc-700 text-right">{{ c.texto }}</span>
              </button>
            </div>
            <button v-if="destinoSel" @click="pasarClase" :disabled="guardando"
              class="w-full py-3 rounded-full font-black text-sm bg-sky-600 text-white disabled:opacity-50">
              {{ destinoSel.tipo === 'ocupado' ? `Intercambiar con ${destinoSel.p.nombre}` : `Pasar a ${destinoSel.p.nombre}` }}
            </button>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button v-if="modal.hayDatos" @click="vaciarCelda" :disabled="guardando"
            class="px-4 py-4 rounded-full font-black text-sm text-red-700 bg-red-50 border-2 border-red-200">Vaciar</button>
          <button @click="guardarCelda" :disabled="guardando"
            class="flex-1 py-4 rounded-full font-black bg-zinc-900 text-white text-base disabled:opacity-50">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="aviso" class="toast-pos fixed left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-lg">{{ aviso }}</div>
    <div v-if="errorMsg" class="toast-pos fixed left-4 right-4 z-[60] bg-red-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg">{{ errorMsg }}</div>
  </div>
</template>
