<script setup>
import { ref, computed, watch } from 'vue'
const route = useRoute()
const logout = () => {
  const cookieAuth = useCookie('auth_token')
  cookieAuth.value = null
  navigateTo('/login')
}
const abierto = ref(null) // 'servicios' | 'consultas' | null
watch(() => route.path, () => { abierto.value = null })
const alternar = (id) => { abierto.value = abierto.value === id ? null : id }
const enGrupo = (g) => g.items.some(i => route.path.startsWith(i.to))
const grupoAbierto = computed(() => GRUPOS.find(g => g.id === abierto.value))
</script>

<template>
  <div class="min-h-dvh bg-zinc-50 flex flex-col font-sans text-zinc-900">

    <!-- Cabecera -->
    <header class="bg-white/95 backdrop-blur border-b border-zinc-200 sticky top-0 z-30" style="padding-top: env(safe-area-inset-top)">
      <div class="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-3 min-w-0">
          <Logo :size="44" class="shrink-0" />
          <div class="min-w-0">
            <p class="text-base font-black leading-tight text-zinc-950 whitespace-nowrap">Gestor Cole</p>
            <p class="hidden sm:block text-xs font-extrabold uppercase tracking-wider text-zinc-600">CEIP El Zahor</p>
          </div>
        </NuxtLink>

        <!-- Menú en ordenador: dos desplegables -->
        <nav class="hidden md:flex items-center gap-2">
          <NuxtLink to="/" :class="['px-5 py-3 rounded-full text-sm font-black', route.path === '/' ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100']"><span class="inline-flex items-center gap-2"><Icono name="home" :size="20" /> Inicio</span></NuxtLink>
          <div v-for="g in GRUPOS" :key="g.id" class="relative">
            <button @click="alternar(g.id)"
              :class="['px-5 py-3 rounded-full text-sm font-black flex items-center gap-2',
                enGrupo(g) || abierto === g.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100']">
              <Icono :name="g.ico" :size="20" /> {{ g.titulo }} <Icono :name="abierto === g.id ? 'flecha-arriba' : 'flecha-abajo'" :size="16" />
            </button>
            <div v-if="abierto === g.id" class="absolute left-0 top-full mt-2 w-80 bg-white rounded-3xl shadow-xl border border-zinc-200 p-2 z-50">
              <NuxtLink v-for="i in g.items" :key="i.to" :to="i.to"
                :class="['flex items-center gap-4 rounded-2xl px-3 py-3', route.path.startsWith(i.to) ? 'bg-zinc-100' : 'hover:bg-zinc-50']">
                <span :class="['w-12 h-12 rounded-full flex items-center justify-center shrink-0', g.color]"><Icono :name="i.ico" :size="26" /></span>
                <span class="min-w-0">
                  <span class="block text-lg font-black leading-tight">{{ i.txt }}</span>
                  <span class="block text-sm font-semibold text-zinc-600">{{ i.dev ? 'En desarrollo' : i.desc }}</span>
                </span>
              </NuxtLink>
            </div>
          </div>
        </nav>

        <div class="flex items-center text-sm font-black text-zinc-600">
          <NuxtLink to="/editor" aria-label="Editar datos" class="px-3 py-2 rounded-full hover:bg-zinc-100 whitespace-nowrap"><span class="inline-flex items-center gap-2"><Icono name="editar" :size="22" /><span class="hidden sm:inline">Editar</span></span></NuxtLink>
          <button @click="logout" class="px-3 py-2 rounded-full hover:bg-zinc-100 whitespace-nowrap"><span class="inline-flex items-center gap-2"><Icono name="salir" :size="22" /><span class="hidden sm:inline">Salir</span></span></button>
        </div>
      </div>
    </header>
    <div v-if="abierto" class="hidden md:block fixed inset-0 z-40" @click="abierto = null"></div>

    <main class="flex-1 max-w-6xl w-full mx-auto px-5 py-6 pb-40 md:pb-10">
      <slot />
    </main>

    <!-- Móvil: ventana con las opciones de la rama elegida -->
    <div v-if="abierto" class="md:hidden fixed inset-0 z-40 bg-black/40" @click="abierto = null"></div>
    <div v-if="grupoAbierto" class="md:hidden fixed inset-x-3 z-50 bg-white rounded-3xl shadow-2xl p-2 modal-scroll overflow-y-auto"
      style="bottom: calc(5.75rem + env(safe-area-inset-bottom)); max-height: 70dvh">
      <p class="px-4 pt-3 pb-1 text-sm font-black uppercase tracking-wider text-zinc-500">{{ grupoAbierto.titulo }}</p>
      <NuxtLink v-for="i in grupoAbierto.items" :key="i.to" :to="i.to"
        :class="['flex items-center gap-4 rounded-2xl px-3 py-3 min-h-[4.75rem]', route.path.startsWith(i.to) ? 'bg-zinc-100' : 'active:bg-zinc-100']">
        <span :class="['w-14 h-14 rounded-full flex items-center justify-center shrink-0', grupoAbierto.color]"><Icono :name="i.ico" :size="30" /></span>
        <span class="min-w-0">
          <span class="block text-xl font-black leading-tight">{{ i.txt }}</span>
          <span class="block text-sm font-semibold text-zinc-600">{{ i.dev ? 'En desarrollo' : i.desc }}</span>
        </span>
      </NuxtLink>
    </div>

    <!-- Móvil: barra inferior con 3 botones grandes -->
    <nav class="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-200 safe-bottom">
      <div class="grid grid-cols-3 gap-2 px-3 pt-2 pb-2">
        <NuxtLink to="/"
          :class="['flex flex-col items-center justify-center rounded-full h-[4.25rem] text-sm font-black', route.path === '/' && !abierto ? 'bg-zinc-900 text-white' : 'text-zinc-700 bg-zinc-100']">
          <Icono name="home" :size="26" /><span>Inicio</span>
        </NuxtLink>
        <button v-for="g in GRUPOS" :key="g.id" @click="alternar(g.id)"
          :class="['flex flex-col items-center justify-center rounded-full h-[4.25rem] text-sm font-black',
            abierto === g.id || (!abierto && enGrupo(g)) ? 'bg-zinc-900 text-white' : 'text-zinc-700 bg-zinc-100']">
          <Icono :name="g.ico" :size="26" />
          <span class="inline-flex items-center gap-1">{{ g.titulo }} <Icono :name="abierto === g.id ? 'flecha-abajo' : 'flecha-arriba'" :size="14" :stroke="3" /></span>
        </button>
      </div>
    </nav>
  </div>
</template>
