<script setup>
import { ref, computed, onMounted } from 'vue'

const supabase = useSupabaseClient()

const FRANJAS = [
  { id: '8-9', nombre: '8:00 – 9:00', hora: 1 },
  { id: '13.30-14.30', nombre: '13:30 – 14:30', hora: 6 }
]
const dosDig = (n) => String(n).padStart(2, '0')
const aISO = (d) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`
const hoy = aISO(new Date())
const fechaDe = (iso) => new Date(iso + 'T12:00:00')
const fechaBonita = (iso) => fechaDe(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const franja = ref('8-9')
const fecha = ref(hoy)
const cargando = ref(true)
const faltaTabla = ref(false)
const aviso = ref('')
const errorMsg = ref('')

const profesores = ref([])
const asignaturas = ref([])
const cursos = ref([])
const tramos = ref([])
const clases = ref([])
const registros = ref([])

const toast = (m) => { aviso.value = m; setTimeout(() => { if (aviso.value === m) aviso.value = '' }, 2000) }
const fallo = (e) => { console.error(e); errorMsg.value = e?.message || 'Error'; setTimeout(() => (errorMsg.value = ''), 5000) }

async function cargar() {
  const [p, a, c, t, cl, r] = await Promise.all([
    supabase.from('profesores').select('*').order('nombre'),
    supabase.from('asignaturas').select('*'),
    supabase.from('cursos').select('*'),
    supabase.from('tramos_horarios').select('*'),
    supabase.from('clases').select('id, profesor_id, curso_id, asignatura_id, tramo_id').limit(5000),
    supabase.from('servicios_sustitucion').select('*').order('fecha', { ascending: false }).limit(2000)
  ])
  profesores.value = p.data || []; asignaturas.value = a.data || []; cursos.value = c.data || []
  tramos.value = t.data || []; clases.value = cl.data || []
  if (r.error) { faltaTabla.value = true; registros.value = [] } else { faltaTabla.value = false; registros.value = r.data }
}
onMounted(async () => { await cargar(); cargando.value = false })

const asigPorId = computed(() => Object.fromEntries(asignaturas.value.map(a => [a.id, a])))
const cursoPorId = computed(() => Object.fromEntries(cursos.value.map(c => [c.id, c])))
const profPorId = computed(() => Object.fromEntries(profesores.value.map(p => [p.id, p])))
const pool = computed(() => profesores.value.filter(p => p.participa_servicios))
const franjaActual = computed(() => FRANJAS.find(f => f.id === franja.value))
const diaSemana = computed(() => { const d = fechaDe(fecha.value).getDay(); return d === 0 ? 7 : d })
const esFinde = computed(() => diaSemana.value > 5)

const sustituye = (asigId) => { const a = asigPorId.value[asigId]; return !!a && (a.sustituye ?? a.codigo === 'GUARDIA') }

// ---------- reparto (para que no le toque siempre al mismo) ----------
const stats = computed(() => {
  const m = {}
  pool.value.forEach(p => (m[p.id] = { total: 0, f: { '8-9': 0, '13.30-14.30': 0 }, ultima: null, proxima: null }))
  registros.value.forEach(r => {
    const s = m[r.profesor_id]; if (!s) return
    s.total++; s.f[r.franja] = (s.f[r.franja] || 0) + 1
    if (r.fecha <= hoy && (!s.ultima || r.fecha > s.ultima)) s.ultima = r.fecha
    if (r.fecha >= hoy && (!s.proxima || r.fecha < s.proxima)) s.proxima = r.fecha
  })
  return m
})

const estadoEseDia = (p) => {
  if (esFinde.value) return { tipo: 'finde', texto: 'Fin de semana' }
  const t = tramos.value.find(x => x.dia_semana === diaSemana.value && x.hora_num === franjaActual.value.hora)
  const filas = clases.value.filter(c => c.profesor_id === p.id && c.tramo_id === t?.id)
  if (!filas.length) return { tipo: 'libre', texto: 'Sin clase a esa hora' }
  if (sustituye(filas[0].asignatura_id)) return { tipo: 'libre', texto: `Tiene ${asigPorId.value[filas[0].asignatura_id]?.nombre} (no da clase)` }
  const cs = filas.map(f => cursoPorId.value[f.curso_id]?.nombre).filter(Boolean).join(' · ')
  return { tipo: 'ocupado', texto: `Da ${asigPorId.value[filas[0].asignatura_id]?.nombre}${cs ? ' a ' + cs : ''}` }
}

const yaAsignados = computed(() => registros.value.filter(r => r.fecha === fecha.value && r.franja === franja.value))

const candidatos = computed(() => {
  const lista = pool.value.map(p => ({ p, st: stats.value[p.id], estado: estadoEseDia(p) }))
  lista.sort((a, b) =>
    (a.estado.tipo === 'ocupado') - (b.estado.tipo === 'ocupado') ||
    (a.st.f[franja.value] - b.st.f[franja.value]) ||     // menos veces en esta franja primero
    (a.st.total - b.st.total) ||
    ((a.st.ultima || '') < (b.st.ultima || '') ? -1 : (a.st.ultima || '') > (b.st.ultima || '') ? 1 : 0) ||
    a.p.nombre.localeCompare(b.p.nombre))
  return lista
})
const sugerido = computed(() => candidatos.value.find(c => c.estado.tipo === 'libre' && !yaAsignados.value.some(r => r.profesor_id === c.p.id)))

async function asignar(c) {
  if (c.p.id === porId.value) return fallo({ message: 'No puede sustituirse a sí mismo' })
  if (!porId.value && !confirm('No has indicado a quién sustituye. ¿Apuntar igualmente?')) return
  if (c.estado.tipo === 'ocupado' && !confirm(`${c.p.nombre}: ${c.estado.texto}. ¿Asignarle el servicio igualmente?`)) return
  const { error } = await supabase.from('servicios_sustitucion').insert({ fecha: fecha.value, franja: franja.value, profesor_id: c.p.id, sustituye_a_id: porId.value })
  if (error) return fallo(error)
  await cargar(); toast(`Apuntado: ${c.p.nombre} ✓`)
}
async function borrar(r) {
  if (!confirm(`¿Quitar a ${profPorId.value[r.profesor_id]?.nombre} del ${fechaBonita(r.fecha)}?`)) return
  const { error } = await supabase.from('servicios_sustitucion').delete().eq('id', r.id)
  if (error) return fallo(error); await cargar(); toast('Quitado')
}

const estadoReg = (r) => r.fecha < hoy ? { t: 'Hecho', c: 'bg-zinc-100 text-zinc-600' } : r.fecha === hoy ? { t: 'Hoy', c: 'bg-emerald-100 text-emerald-800' } : { t: 'Pendiente', c: 'bg-amber-100 text-amber-900' }
const nombreFranja = (id) => FRANJAS.find(f => f.id === id)?.nombre
const proximos = computed(() => registros.value.filter(r => r.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)))
const historial = computed(() => registros.value.filter(r => r.fecha < hoy))
const mostrarTodo = ref(false)
const porId = ref(null)   // profesor al que se sustituye
const nombreProf = (id) => profPorId.value[id]?.nombre
const moverFecha = (n) => { const d = fechaDe(fecha.value); d.setDate(d.getDate() + n); fecha.value = aISO(d) }
</script>

<template>
  <div class="max-w-xl mx-auto px-0 py-0 font-sans text-zinc-900 md:max-w-4xl">
    <header class="mb-6">
      <div class="">
        <h1 class="text-3xl font-black tracking-tight">Sustituciones</h1>
        <p class="text-zinc-600 font-semibold text-sm mt-1">Servicios de 8:00 a 9:00 y de 13:30 a 14:30. Un registro para repartirlos entre todos por igual.</p>
      </div>
    </header>

    <p v-if="cargando" class="text-center py-12 font-bold animate-pulse">Cargando…</p>

    <div v-else-if="faltaTabla" class="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 font-bold text-amber-900">
      Falta crear la tabla de servicios. Ejecuta <b>scripts/migracion-2026-c.sql</b> en el SQL Editor de Supabase y recarga.
    </div>

    <div v-else class="space-y-6">
      <section class="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">1. ¿Qué servicio?</p>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="f in FRANJAS" :key="f.id" @click="franja = f.id"
              :class="['py-4 rounded-full font-black border-2', franja === f.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-800 border-zinc-200']">
              {{ f.nombre }}
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">2. ¿Qué día?</p>
          <div class="flex items-center gap-2">
            <button @click="moverFecha(-1)" class="w-12 h-12 shrink-0 rounded-full bg-zinc-100 flex items-center justify-center"><Icono name="flecha-izq" :size="22" :stroke="2.5" /></button>
            <input type="date" v-model="fecha" class="flex-1 min-w-0 bg-zinc-100 rounded-full px-5 h-12 font-black text-base focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            <button @click="moverFecha(1)" class="w-12 h-12 shrink-0 rounded-full bg-zinc-100 flex items-center justify-center"><Icono name="flecha-der" :size="22" :stroke="2.5" /></button>
          </div>
          <p class="text-sm font-black text-zinc-700 mt-2 first-letter:uppercase">{{ fechaBonita(fecha) }}
            <button v-if="fecha !== hoy" @click="fecha = hoy" class="ml-2 text-xs underline text-sky-700 normal-case">ir a hoy</button></p>
        </div>

        <div v-if="yaAsignados.length" class="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3">
          <p class="text-xs font-black uppercase tracking-wider text-emerald-900 mb-1">Ya apuntado para este servicio</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="r in yaAsignados" :key="r.id" class="bg-emerald-500 text-white font-black text-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
              {{ nombreProf(r.profesor_id) }}<span v-if="r.sustituye_a_id" class="font-bold opacity-90"> (por {{ nombreProf(r.sustituye_a_id) }})</span> <button @click="borrar(r)" class="opacity-80 inline-flex"><Icono name="cerrar" :size="16" :stroke="3" /></button>
            </span>
          </div>
        </div>
      </section>

      <section>
        <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">3. ¿A quién le toca? <span class="font-bold text-zinc-600 normal-case">(ordenado: a quien menos le ha tocado, primero)</span></p>
        <div class="mb-3">
          <label class="block text-xs font-extrabold uppercase text-zinc-600 mb-1">¿A quién se sustituye?</label>
          <select v-model="porId" class="w-full bg-zinc-100 rounded-full px-5 h-14 font-black focus:outline-none focus:ring-2 focus:ring-zinc-900">
            <option :value="null">— elige al profesor/a que falta —</option>
            <option v-for="p in profesores" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
        </div>
        <p v-if="esFinde" class="bg-zinc-100 rounded-2xl p-4 font-bold text-zinc-600">Ese día es fin de semana.</p>
        <div class="grid gap-3">
          <div v-for="c in candidatos" :key="c.p.id"
            :class="['rounded-3xl p-4 flex items-center gap-3',
              c.estado.tipo === 'ocupado' ? 'bg-red-50 ring-1 ring-red-200'
                : sugerido?.p.id === c.p.id ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-emerald-50 ring-1 ring-emerald-200']">
            <div class="flex-1 min-w-0">
              <p class="font-black text-lg leading-tight">
                {{ c.p.nombre }}
                <span v-if="sugerido?.p.id === c.p.id" class="ml-1 text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5 align-middle uppercase tracking-wider">Le toca</span>
              </p>
              <p :class="['text-sm font-bold mt-0.5', c.estado.tipo === 'ocupado' ? 'text-red-700' : 'text-emerald-800']">
                {{ c.estado.tipo === 'ocupado' ? '● ' : '● ' }}{{ c.estado.texto }}
              </p>
              <p class="text-xs font-bold text-zinc-600 mt-1.5">
                Lo ha hecho <b class="text-zinc-800">{{ c.st.f[franja] }}</b> {{ c.st.f[franja] === 1 ? 'vez' : 'veces' }} en este horario
                · {{ c.st.ultima ? 'última ' + fechaDe(c.st.ultima).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'nunca' }}
                <template v-if="c.st.proxima"> · próxima {{ fechaDe(c.st.proxima).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }}</template>
              </p>
            </div>
            <button @click="asignar(c)" :disabled="esFinde || c.p.id === porId || yaAsignados.some(r => r.profesor_id === c.p.id)"
              :class="['shrink-0 text-white font-black text-sm rounded-full px-5 h-12 disabled:opacity-30', c.estado.tipo === 'ocupado' ? 'bg-red-500' : 'bg-emerald-600']">Apuntar</button>
          </div>
        </div>
        <p v-if="!pool.length" class="font-bold text-zinc-600 p-4">Nadie está marcado para servicios. Márcalos en Editar → Profesores.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-black uppercase tracking-wider text-zinc-700">Registro</h2>
        <div v-if="proximos.length" class="space-y-1.5">
          <p class="text-xs font-extrabold uppercase text-zinc-600">Hoy y próximos</p>
          <div v-for="r in proximos" :key="r.id" class="bg-white border-2 border-zinc-200 rounded-2xl px-3 py-2.5 flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm first-letter:uppercase">{{ fechaBonita(r.fecha) }} · {{ nombreFranja(r.franja) }}</p>
              <p class="text-xs font-bold text-zinc-700">{{ nombreProf(r.profesor_id) }} <span class="text-zinc-600">sustituye a</span> {{ r.sustituye_a_id ? nombreProf(r.sustituye_a_id) : '—' }}</p>
            </div>
            <span :class="['text-xs font-black uppercase rounded-md px-2 py-1', estadoReg(r).c]">{{ estadoReg(r).t }}</span>
            <button @click="borrar(r)" class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 active:bg-zinc-100"><Icono name="cerrar" :size="20" /></button>
          </div>
        </div>
        <div v-if="historial.length" class="space-y-1.5">
          <p class="text-xs font-extrabold uppercase text-zinc-600 pt-2">Ya hechos</p>
          <div v-for="r in (mostrarTodo ? historial : historial.slice(0, 8))" :key="r.id" class="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2 flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm first-letter:uppercase">{{ fechaBonita(r.fecha) }} · {{ nombreFranja(r.franja) }}</p>
              <p class="text-xs font-bold text-zinc-600">{{ nombreProf(r.profesor_id) }} <span class="text-zinc-500">sustituyó a</span> {{ r.sustituye_a_id ? nombreProf(r.sustituye_a_id) : '—' }}</p>
            </div>
            <button @click="borrar(r)" class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 active:bg-zinc-100"><Icono name="cerrar" :size="20" /></button>
          </div>
          <button v-if="historial.length > 8" @click="mostrarTodo = !mostrarTodo" class="text-xs font-black underline text-zinc-600">
            {{ mostrarTodo ? 'Ver menos' : `Ver todo (${historial.length})` }}
          </button>
        </div>
        <p v-if="!registros.length" class="text-sm font-bold text-zinc-600">Todavía no hay servicios apuntados.</p>
      </section>
    </div>

    <div v-if="aviso" class="toast-pos fixed left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-lg">{{ aviso }}</div>
    <div v-if="errorMsg" class="toast-pos fixed left-4 right-4 z-[60] bg-red-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg">{{ errorMsg }}</div>
  </div>
</template>
