// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-08-03',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase'
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Gestor Cole · CEIP El Zahor',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      meta: [
        // viewport-fit=cover: la app usa toda la pantalla del iPhone (notch y barra inferior) respetando las zonas seguras
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fafafa' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Gestor Cole' },
        { name: 'format-detection', content: 'telephone=no' }
      ]
    }
  },
  supabase: {
    redirect: false // Desactivamos el redireccionamiento automático de login por ahora para trabajar cómodos
  }
})
