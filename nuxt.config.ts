// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-08-03',
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase'
  ],
  supabase: {
    redirect: false // Desactivamos el redireccionamiento automático de login por ahora para trabajar cómodos
  }
})