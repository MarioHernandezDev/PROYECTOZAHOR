<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { PATIOS, DIAS, TURNOS, DISPONIBLES, quitaTildes } from '~/utils/recreos'

const supabase = useSupabaseClient()

const dosDig = (n) => String(n).padStart(2, '0')
const aISO = (d) => `${d.getFullYear()}-${dosDig(d.getMonth() + 1)}-${dosDig(d.getDate())}`
const hoy = aISO(new Date())
const fechaDe = (iso) => new Date(iso + 'T12:00:00')
const fechaBonita = (iso) => fechaDe(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const fechaCorta = (iso) => fechaDe(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

const fecha = ref(hoy)
const patio = ref('arriba')
const falta = ref('')            // nombre de quien falta
const cargando = ref(true)
const faltaTabla = ref(false)
const aviso = ref('')
const errorMsg = ref('')
const profesores = ref([])
const registros = ref([])
const mostrarTodo = ref(false)
const verHorario = ref(false)

const toast = (m) => { aviso.value = m; setTimeout(() => { if (aviso.value === m) aviso.value = '' }, 2000) }
const fallo = (e) => { console.error(e); errorMsg.value = e?.message || 'Error'; setTimeout(() => (errorMsg.value = ''), 5000) }

async function cargar() {
  const [p, r] = await Promise.all([
    supabase.from('profesores').select('id, nombre').order('nombre'),
    supabase.from('recreos_sustituciones').select('*').order('fecha', { ascending: false }).limit(2000)
  ])
  profesores.value = p.data || []
  if (r.error) { faltaTabla.value = true; registros.value = [] } else { faltaTabla.value = false; registros.value = r.data }
}
onMounted(async () => { await cargar(); cargando.value = false })

const diaSemana = computed(() => { const d = fechaDe(fecha.value).getDay(); return d === 0 ? 7 : d })
const esFinde = computed(() => diaSemana.value > 5)
const nombreDia = computed(() => DIAS[diaSemana.value - 1])

const profPorNombre = computed(() => Object.fromEntries(profesores.value.map(p => [quitaTildes(p.nombre), p])))
const profPorId = computed(() => Object.fromEntries(profesores.value.map(p => [p.id, p])))
const pool = computed(() => DISPONIBLES.map(n => profPorNombre.value[quitaTildes(n)]).filter(Boolean))
const faltanEnBD = computed(() => DISPONIBLES.filter(n => !profPorNombre.value[quitaTildes(n)]))

// ---------- quién vigila cada patio el día elegido ----------
const turnoDelDia = (id) => esFinde.value ? [] : TURNOS[id][diaSemana.value - 1]
const enPatioHoy = computed(() => new Set(PATIOS.flatMap(p => turnoDelDia(p.id)).map(quitaTildes)))
const vigilantes = computed(() => turnoDelDia(patio.value))

// Al cambiar de día o patio, la persona que falta deja de ser válida
watch([fecha, patio], () => { if (falta.value && !vigilantes.value.includes(falta.value)) falta.value = '' })

// ---------- reparto ----------
const stats = computed(() => {
  const m = {}
  pool.value.forEach(p => (m[p.id] = { total: 0, ultima: null, proxima: null }))
  registros.value.forEach(r => {
    const s = m[r.profesor_id]; if (!s) return
    s.total++
    if (r.fecha <= hoy && (!s.ultima || r.fecha > s.ultima)) s.ultima = r.fecha
    if (r.fecha >= hoy && (!s.proxima || r.fecha < s.proxima)) s.proxima = r.fecha
  })
  return m
})

const yaAsignados = computed(() => registros.value.filter(r => r.fecha === fecha.value && r.patio === patio.value))
const yaEseDia = (p) => registros.value.some(r => r.fecha === fecha.value && r.profesor_id === p.id)

const candidatos = computed(() => {
  if (esFinde.value) return []
  return pool.value
    .filter(p => !enPatioHoy.value.has(quitaTildes(p.nombre)))      // no está en ningún patio ese día
    .map(p => ({ p, st: stats.value[p.id], ocupado: yaEseDia(p) }))
    .sort((a, b) =>
      (a.ocupado - b.ocupado) ||
      (a.st.total - b.st.total) ||                                   // menos sustituciones primero
      ((a.st.ultima || '') < (b.st.ultima || '') ? -1 : (a.st.ultima || '') > (b.st.ultima || '') ? 1 : 0) ||
      a.p.nombre.localeCompare(b.p.nombre))
})
const sugerido = computed(() => candidatos.value.find(c => !c.ocupado))

async function asignar(c) {
  if (!falta.value && !confirm('No has indicado a quién sustituye. ¿Apuntar igualmente?')) return
  const { error } = await supabase.from('recreos_sustituciones').insert({ fecha: fecha.value, patio: patio.value, profesor_id: c.p.id, sustituye_a: falta.value || null })
  if (error) return fallo(error)
  await cargar(); toast(`Apuntado: ${c.p.nombre} ✓`)
}
async function borrar(r) {
  if (!confirm(`¿Quitar a ${profPorId.value[r.profesor_id]?.nombre} del ${fechaBonita(r.fecha)}?`)) return
  const { error } = await supabase.from('recreos_sustituciones').delete().eq('id', r.id)
  if (error) return fallo(error); await cargar(); toast('Quitado')
}

const estadoReg = (r) => r.fecha < hoy ? { t: 'Hecho', c: 'bg-zinc-100 text-zinc-600' } : r.fecha === hoy ? { t: 'Hoy', c: 'bg-emerald-100 text-emerald-800' } : { t: 'Pendiente', c: 'bg-amber-100 text-amber-900' }
const nombrePatio = (id) => PATIOS.find(p => p.id === id)?.nombre
const nombreProf = (id) => profPorId.value[id]?.nombre
const proximos = computed(() => registros.value.filter(r => r.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)))
const historial = computed(() => registros.value.filter(r => r.fecha < hoy))
const moverFecha = (n) => { const d = fechaDe(fecha.value); d.setDate(d.getDate() + n); fecha.value = aISO(d) }
</script>

<template>
  <div class="max-w-xl mx-auto px-0 py-0 font-sans text-zinc-900 md:max-w-4xl">
    <header class="mb-6">
      <h1 class="text-3xl font-black tracking-tight">Recreos</h1>
      <p class="text-zinc-600 font-semibold text-sm mt-1">Vigilancia de patios de 11:00 a 11:30. Apunta quién sustituye cuando falta alguien.</p>
    </header>

    <p v-if="cargando" class="text-center py-12 font-bold animate-pulse">Cargando…</p>

    <div v-else-if="faltaTabla" class="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 font-bold text-amber-900">
      Falta crear la tabla de recreos. Ejecuta <b>scripts/migracion-2026-d.sql</b> en el SQL Editor de Supabase y recarga.
    </div>

    <div v-else class="space-y-6">
      <section class="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
        <div>
          <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">1. ¿Qué día?</p>
          <div class="flex items-center gap-2">
            <button @click="moverFecha(-1)" class="w-12 h-12 shrink-0 rounded-full bg-zinc-100 flex items-center justify-center"><Icono name="flecha-izq" :size="22" :stroke="2.5" /></button>
            <input type="date" v-model="fecha" class="flex-1 min-w-0 bg-zinc-100 rounded-full px-5 h-12 font-black text-base focus:outline-none focus:ring-2 focus:ring-zinc-900" />
            <button @click="moverFecha(1)" class="w-12 h-12 shrink-0 rounded-full bg-zinc-100 flex items-center justify-center"><Icono name="flecha-der" :size="22" :stroke="2.5" /></button>
          </div>
          <p class="text-sm font-black text-zinc-700 mt-2 first-letter:uppercase">{{ fechaBonita(fecha) }}
            <button v-if="fecha !== hoy" @click="fecha = hoy" class="ml-2 text-xs underline text-sky-700 normal-case">ir a hoy</button></p>
        </div>

        <p v-if="esFinde" class="bg-zinc-100 rounded-2xl p-4 font-bold text-zinc-600">Ese día es fin de semana.</p>

        <template v-else>
          <div>
            <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">2. ¿Qué patio?</p>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="p in PATIOS" :key="p.id" @click="patio = p.id"
                :class="['py-4 rounded-full font-black border-2', patio === p.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-50 text-zinc-800 border-zinc-200']">
                {{ p.nombre }}
              </button>
            </div>
          </div>

          <div>
            <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">3. ¿Quién falta? <span class="font-bold text-zinc-600 normal-case">(vigila el {{ nombreDia.toLowerCase() }} en este patio)</span></p>
            <div class="flex flex-wrap gap-2">
              <button v-for="n in vigilantes" :key="n" @click="falta = falta === n ? '' : n"
                :class="['px-5 h-12 rounded-full font-black border-2', falta === n ? 'bg-red-500 text-white border-red-500' : 'bg-zinc-50 text-zinc-800 border-zinc-200']">
                {{ n }}
              </button>
            </div>
          </div>
        </template>

        <div v-if="yaAsignados.length" class="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3">
          <p class="text-xs font-black uppercase tracking-wider text-emerald-900 mb-1">Ya apuntado en este patio</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="r in yaAsignados" :key="r.id" class="bg-emerald-500 text-white font-black text-sm rounded-xl px-3 py-1.5 flex items-center gap-2">
              {{ nombreProf(r.profesor_id) }}<span v-if="r.sustituye_a" class="font-bold opacity-90"> (por {{ r.sustituye_a }})</span>
              <button @click="borrar(r)" class="opacity-80 inline-flex"><Icono name="cerrar" :size="16" :stroke="3" /></button>
            </span>
          </div>
        </div>
      </section>

      <section v-if="!esFinde">
        <p class="text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">4. ¿A quién le toca? <span class="font-bold text-zinc-600 normal-case">(libres ese día; a quien menos ha sustituido, primero)</span></p>
        <div class="grid gap-3">
          <div v-for="c in candidatos" :key="c.p.id"
            :class="['rounded-3xl p-4 flex items-center gap-3',
              c.ocupado ? 'bg-zinc-100 ring-1 ring-zinc-200' : sugerido?.p.id === c.p.id ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-emerald-50 ring-1 ring-emerald-200']">
            <div class="flex-1 min-w-0">
              <p class="font-black text-lg leading-tight">
                {{ c.p.nombre }}
                <span v-if="sugerido?.p.id === c.p.id" class="ml-1 text-xs bg-emerald-600 text-white rounded-full px-2 py-0.5 align-middle uppercase tracking-wider">Le toca</span>
              </p>
              <p :class="['text-sm font-bold mt-0.5', c.ocupado ? 'text-zinc-600' : 'text-emerald-800']">
                ● {{ c.ocupado ? 'Ya sustituye ese día en otro patio' : 'Libre en el recreo' }}
              </p>
              <p class="text-xs font-bold text-zinc-600 mt-1.5">
                Ha sustituido <b class="text-zinc-800">{{ c.st.total }}</b> {{ c.st.total === 1 ? 'vez' : 'veces' }}
                · {{ c.st.ultima ? 'última ' + fechaCorta(c.st.ultima) : 'nunca' }}
                <template v-if="c.st.proxima"> · próxima {{ fechaCorta(c.st.proxima) }}</template>
              </p>
            </div>
            <button @click="asignar(c)" :disabled="yaAsignados.some(r => r.profesor_id === c.p.id)"
              class="shrink-0 text-white font-black text-sm rounded-full px-5 h-12 disabled:opacity-30 bg-emerald-600">Apuntar</button>
          </div>
        </div>
        <p v-if="faltanEnBD.length" class="text-xs font-bold text-red-700 mt-3">No encuentro en Profesores a: {{ faltanEnBD.join(', ') }}.</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-black uppercase tracking-wider text-zinc-700">Registro</h2>
        <div v-if="proximos.length" class="space-y-1.5">
          <p class="text-xs font-extrabold uppercase text-zinc-600">Hoy y próximos</p>
          <div v-for="r in proximos" :key="r.id" class="bg-white border-2 border-zinc-200 rounded-2xl px-3 py-2.5 flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm first-letter:uppercase">{{ fechaBonita(r.fecha) }} · {{ nombrePatio(r.patio) }}</p>
              <p class="text-xs font-bold text-zinc-700">{{ nombreProf(r.profesor_id) }} <span class="text-zinc-600">sustituye a</span> {{ r.sustituye_a || '—' }}</p>
            </div>
            <span :class="['text-xs font-black uppercase rounded-md px-2 py-1', estadoReg(r).c]">{{ estadoReg(r).t }}</span>
            <button @click="borrar(r)" class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-zinc-600 active:bg-zinc-100"><Icono name="cerrar" :size="20" /></button>
          </div>
        </div>
        <div v-if="historial.length" class="space-y-1.5">
          <p class="text-xs font-extrabold uppercase text-zinc-600 pt-2">Ya hechos</p>
          <div v-for="r in (mostrarTodo ? historial : historial.slice(0, 8))" :key="r.id" class="bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-2 flex items-center gap-2">
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm first-letter:uppercase">{{ fechaBonita(r.fecha) }} · {{ nombrePatio(r.patio) }}</p>
              <p class="text-xs font-bold text-zinc-600">{{ nombreProf(r.profesor_id) }} <span class="text-zinc-500">sustituyó a</span> {{ r.sustituye_a || '—' }}</p>
            </div>
            <button @click="borrar(r)" class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 active:bg-zinc-100"><Icono name="cerrar" :size="20" /></button>
          </div>
          <button v-if="historial.length > 8" @click="mostrarTodo = !mostrarTodo" class="text-xs font-black underline text-zinc-600">
            {{ mostrarTodo ? 'Ver menos' : `Ver todo (${historial.length})` }}
          </button>
        </div>
        <p v-if="!registros.length" class="text-sm font-bold text-zinc-600">Todavía no hay sustituciones apuntadas.</p>
      </section>

      <section class="space-y-2">
        <button @click="verHorario = !verHorario" class="text-sm font-black uppercase tracking-wider text-zinc-700 underline">
          {{ verHorario ? 'Ocultar' : 'Ver' }} turnos de patio
        </button>
        <div v-if="verHorario" class="grid gap-3 md:grid-cols-2">
          <div v-for="p in PATIOS" :key="p.id" class="bg-white border border-zinc-200 rounded-2xl p-3">
            <p class="font-black mb-2">{{ p.nombre }}</p>
            <div v-for="(d, i) in DIAS" :key="d" class="flex gap-2 text-sm py-1 border-t border-zinc-100">
              <span class="w-24 shrink-0 font-black text-zinc-700">{{ d }}</span>
              <span class="font-semibold">{{ TURNOS[p.id][i].join(' · ') }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="aviso" class="toast-pos fixed left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-lg">{{ aviso }}</div>
    <div v-if="errorMsg" class="toast-pos fixed left-4 right-4 z-[60] bg-red-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg">{{ errorMsg }}</div>
  </div>
</template>
