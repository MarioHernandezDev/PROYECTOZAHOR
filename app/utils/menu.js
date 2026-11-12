// Menú de la app: dos ramas. Se usa en el menú desplegable y en la portada.
export const GRUPOS = [
  {
    id: 'servicios', titulo: 'Servicios', ico: 'servicios', color: 'bg-indigo-100 text-indigo-800',
    desc: 'Organizar y apuntar',
    items: [
      { to: '/refuerzos', txt: 'Refuerzos', ico: 'refuerzos', desc: 'Quién refuerza a qué curso', corta: 'Quién refuerza' },
      { to: '/sustituciones', txt: 'Sustituciones', ico: 'sustituciones', desc: 'Servicios de 8 a 9 y de 13:30 a 14:30', corta: 'Turnos 8–9 y 13:30' },
      { to: '/recreos', txt: 'Recreos', ico: 'recreos', desc: 'Turnos de vigilancia', dev: true }
    ]
  },
  {
    id: 'consultas', titulo: 'Consultas', ico: 'consultas', color: 'bg-emerald-100 text-emerald-800',
    desc: 'Mirar horarios y faltas',
    items: [
      { to: '/ausencias', txt: 'Ausencias', ico: 'ausencias', desc: 'Quién puede cubrir una falta', destacado: true },
      { to: '/profesores', txt: 'Profesores', ico: 'profesores', desc: 'Horario de cada profesor', corta: 'Su horario semanal' },
      { to: '/aulas', txt: 'Cursos', ico: 'cursos', desc: 'Horario de cada curso', corta: 'Su horario semanal' }
    ]
  }
]
