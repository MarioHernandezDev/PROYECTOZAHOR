// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const cookieAuth = useCookie('auth_token')

  // Si no está autenticado y no está ya en la página de login, lo mandamos al /login
  if (cookieAuth.value !== 'autenticado' && to.path !== '/login') {
    return navigateTo('/login')
  }

  // Si ya está autenticado e intenta ir a /login, lo mandamos al inicio
  if (cookieAuth.value === 'autenticado' && to.path === '/login') {
    return navigateTo('/')
  }
})