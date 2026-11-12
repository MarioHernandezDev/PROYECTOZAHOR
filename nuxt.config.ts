// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2026-08-03',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@vite-pwa/nuxt'
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
        { name: 'theme-color', content: '#ffffff' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        // 'default': barra de estado con texto oscuro, que se lee bien sobre la cabecera blanca
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Gestor Cole' },
        { name: 'format-detection', content: 'telephone=no' }
      ]
    }
  },
  supabase: {
    redirect: false // Desactivamos el redireccionamiento automático de login por ahora para trabajar cómodos
  },
  // App instalable en el móvil (PWA)
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Gestor Cole - CEIP El Zahor',
      short_name: 'Gestor Cole',
      description: 'Horarios, ausencias, refuerzos y sustituciones del CEIP El Zahor',
      lang: 'es',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fafafa',
      theme_color: '#ffffff',
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
  }
})
