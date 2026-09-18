// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-08-03',
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt'
  ],
  supabase: {
    redirect: false // Desactivamos el redireccionamiento automático de login por ahora para trabajar cómodos
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Horarios Cole - CEIP El Zahor',
      short_name: 'Horarios',
      description: 'Horarios, ausencias y guardias del CEIP El Zahor',
      lang: 'es',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fafafa',
      theme_color: '#18181b',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,html,png,svg,ico}']
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false
    }
  },
  app: {
    head: {
      link: [
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ],
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Horarios' },
        { name: 'theme-color', content: '#18181b' }
      ]
    }
  }
})