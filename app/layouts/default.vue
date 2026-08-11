<script setup>
const logout = () => {
  const cookieAuth = useCookie('auth_token')
  cookieAuth.value = null
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
    
    <header class="bg-white border-b-2 border-zinc-200 sticky top-0 z-30">
      <div class="max-w-6xl mx-auto px-4 py-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
        
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-zinc-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
            :)
          </div>
          <div>
            <h1 class="text-base font-black leading-tight text-zinc-950">Horarios Cole</h1>
            <p class="text-[11px] font-extrabold uppercase tracking-wider text-zinc-600">CEIP El Zahor</p>
          </div>
        </div>

        <nav class="grid grid-cols-3 gap-1.5 md:flex md:items-center md:gap-2">
          
          <NuxtLink 
            to="/" 
            class="py-3 px-3 md:py-2.5 md:px-4 rounded-2xl text-center text-xs font-black uppercase tracking-wider text-zinc-700 bg-zinc-100/80 hover:bg-zinc-200/80 md:bg-transparent md:hover:bg-zinc-100 transition-all border border-zinc-200/60 md:border-transparent"
            active-class="!bg-zinc-900 !text-white !border-zinc-900 shadow-xs"
          >
            Profesores
          </NuxtLink>
          
          <NuxtLink 
            to="/aulas" 
            class="py-3 px-3 md:py-2.5 md:px-4 rounded-2xl text-center text-xs font-black uppercase tracking-wider text-zinc-700 bg-zinc-100/80 hover:bg-zinc-200/80 md:bg-transparent md:hover:bg-zinc-100 transition-all border border-zinc-200/60 md:border-transparent"
            active-class="!bg-zinc-900 !text-white !border-zinc-900 shadow-xs"
          >
            Cursos
          </NuxtLink>
          
          <NuxtLink 
            to="/ausencias" 
            class="py-3 px-3 md:py-2.5 md:px-4 rounded-2xl text-center text-xs font-black uppercase tracking-wider bg-amber-200 text-amber-950 border-2 border-amber-300 hover:bg-amber-300 transition-all"
            active-class="!bg-amber-500 !text-zinc-950 !border-amber-600 shadow-xs"
          >
            Ausencias
          </NuxtLink>

        </nav>

      </div>
    </header>

    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
      <slot />
    </main>

    <footer class="bg-white border-t-2 border-zinc-200 mt-auto">
      <div class="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-black uppercase tracking-wider text-zinc-700">
            Sistema activo · CEIP El Zahor
          </span>
        </div>

        <div class="flex items-center gap-4 text-center sm:text-right">
          <p class="text-xs font-extrabold text-zinc-500 uppercase tracking-widest">
            Horarios Yolanda &copy; {{ new Date().getFullYear() }}
          </p>
          <span class="text-zinc-300">|</span>
          <button 
            @click="logout" 
            class="text-xs font-black text-zinc-500 hover:text-zinc-900 uppercase tracking-wider underline cursor-pointer transition-colors"
          >
            Salir
          </button>
        </div>

      </div>
    </footer>

  </div>
</template>