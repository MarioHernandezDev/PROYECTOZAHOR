<script setup>
definePageMeta({
  layout: false // Desactiva el layout predeterminado para que no salga la cabecera/footer
})

const passwordInput = ref('')
const error = ref(false)
const cookieAuth = useCookie('auth_token', { maxAge: 60 * 60 * 24 * 30 }) // Dura 30 días

const handleLogin = () => {
  if (passwordInput.value === 'zahor321') {
    cookieAuth.value = 'autenticado'
    navigateTo('/')
  } else {
    error.value = true
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-100 flex items-center justify-center p-4 font-sans text-zinc-900">
    <div class="bg-white p-8 rounded-3xl border-2 border-zinc-200 shadow-sm w-full max-w-sm space-y-6">
      
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center font-black text-xl mx-auto shadow-sm">
          H
        </div>
        <h1 class="text-2xl font-black tracking-tight text-zinc-900">Acceso Privado</h1>
        <p class="text-xs font-bold uppercase tracking-wider text-zinc-500">Gestor de Horarios</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="password" class="block text-xs font-black uppercase text-zinc-700 tracking-wider mb-2">
            Contraseña de acceso
          </label>
          <input 
            id="password"
            type="password"
            v-model="passwordInput"
            placeholder="Introduce la clave..."
            class="w-full border-2 border-zinc-300 rounded-2xl px-4 py-3 text-base font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none transition-all"
          />
        </div>

        <p v-if="error" class="text-xs font-black text-red-600 text-center bg-red-50 py-2 rounded-xl border border-red-200">
          Clave incorrecta. Inténtalo de nuevo.
        </p>

        <button 
          type="submit"
          class="w-full py-4 bg-zinc-900 text-white font-black text-sm uppercase tracking-wider rounded-2xl hover:bg-zinc-800 transition-all shadow-sm active:scale-[0.98]"
        >
          Entrar
        </button>
      </form>

    </div>
  </div>
</template>