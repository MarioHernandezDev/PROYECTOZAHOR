<script setup>
// Ausencias es lo que más se usa: tarjeta grande arriba. El resto, tarjetas por grupo.
const hero = GRUPOS.flatMap(g => g.items).find(i => i.destacado)
const secciones = [GRUPOS[1], GRUPOS[0]].map(g => ({ ...g, items: g.items.filter(i => !i.destacado) }))

// Cada grupo tiene su color de acento (el medallón del icono)
const acento = {
  consultas: 'from-emerald-500 to-emerald-700 shadow-emerald-700/30',
  servicios: 'from-indigo-500 to-indigo-700 shadow-indigo-700/30'
}
</script>

<template>
  <div class="max-w-xl mx-auto md:max-w-4xl font-sans text-zinc-900">

    <!-- Lo más usado -->
    <NuxtLink :to="hero.to"
      class="relative block overflow-hidden rounded-[2rem] p-5 text-zinc-950 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400
             shadow-[0_14px_32px_-14px_rgba(234,138,0,.75)] active:scale-[.99] transition-transform">
      <Icono :name="hero.ico" :size="170" :stroke="1.4" class="absolute -right-10 -bottom-12 opacity-[.10]" />
      <div class="relative flex items-center gap-4">
        <span class="w-16 h-16 rounded-full bg-white/80 shadow-sm flex items-center justify-center shrink-0"><Icono :name="hero.ico" :size="32" /></span>
        <span class="min-w-0">
          <span class="block text-xs font-black uppercase tracking-wider text-amber-950/70">Lo más usado</span>
          <span class="block text-2xl font-black leading-tight">{{ hero.txt }}</span>
          <span class="block text-base font-bold leading-snug text-amber-950/80">{{ hero.desc }}</span>
        </span>
      </div>
      <span class="relative mt-4 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-zinc-950 text-white text-base font-black">
        Buscar sustituto <Icono name="flecha-der" :size="20" :stroke="3" />
      </span>
    </NuxtLink>

    <section v-for="g in secciones" :key="g.id" class="mt-7">
      <h2 class="text-sm font-black uppercase tracking-wider text-zinc-500 mb-3 px-1">{{ g.titulo }}</h2>
      <div class="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <template v-for="i in g.items" :key="i.to">

          <!-- Opción aún sin hacer -->
          <NuxtLink v-if="i.dev" :to="i.to"
            class="flex items-center gap-3 rounded-[1.75rem] border-2 border-dashed border-zinc-300 px-4 h-[4.5rem] text-zinc-600 active:scale-[.99] transition-transform">
            <span class="w-11 h-11 rounded-full bg-zinc-200 flex items-center justify-center"><Icono :name="i.ico" :size="22" /></span>
            <span class="text-lg font-black">{{ i.txt }}</span>
            <span class="ml-auto whitespace-nowrap text-xs font-black uppercase tracking-wide bg-zinc-200 rounded-full px-3 py-1.5">En desarrollo</span>
          </NuxtLink>

          <NuxtLink v-else :to="i.to"
            class="flex items-center gap-4 rounded-[1.75rem] bg-white p-4 ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,.04),0_10px_24px_-12px_rgba(0,0,0,.2)] active:scale-[.98] transition-transform">
            <span :class="['w-14 h-14 shrink-0 rounded-full bg-gradient-to-br text-white flex items-center justify-center shadow-md', acento[g.id]]">
              <Icono :name="i.ico" :size="28" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block text-xl font-black leading-tight">{{ i.txt }}</span>
              <span class="block text-[0.95rem] font-semibold leading-snug text-zinc-500">{{ i.corta || i.desc }}</span>
            </span>
            <Icono name="flecha-der" :size="22" :stroke="2.5" class="text-zinc-400" />
          </NuxtLink>
        </template>
      </div>
    </section>
  </div>
</template>
