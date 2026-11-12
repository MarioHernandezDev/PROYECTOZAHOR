<template>
  <div class="max-w-xl mx-auto md:max-w-3xl font-sans text-zinc-900">
    <header class="mb-6">
      <h1 class="text-3xl font-black tracking-tight">Recreos</h1>
      <p class="text-zinc-600 font-semibold mt-1">Turnos de vigilancia · 11:00 a 11:30</p>
    </header>
    <div class="bg-white rounded-3xl border border-dashed border-zinc-300 p-10 text-center">
      <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-100 text-zinc-700 flex items-center justify-center"><Icono name="obras" :size="40" /></div>
      <p class="text-2xl font-black mb-2">En desarrollo</p>
      <p class="text-base font-semibold text-zinc-600 max-w-sm mx-auto">Esta parte todavía no está lista. Pronto se podrá organizar aquí.</p>
      <NuxtLink to="/" class="inline-flex items-center justify-center mt-6 h-14 px-8 rounded-full bg-zinc-900 text-white font-black text-lg">Volver al inicio</NuxtLink>
    </div>
  </div>
</template>
