// Turnos de patio en el recreo (11:00 a 11:30). Fijos cada semana.
// Los nombres coinciden con la columna "nombre" de la tabla profesores.
// "J. Eri" y "J. Fran" vigilan pero no están en la lista de quienes sustituyen.
export const PATIOS = [
  { id: 'arriba', nombre: 'Arriba' },
  { id: 'abajo', nombre: 'Abajo' }
]

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

// Índice 0 = lunes … 4 = viernes
export const TURNOS = {
  arriba: [
    ['Deli', 'J. Manuel'],
    ['J. Eri', 'Luz', 'Alicia'],
    ['Deli', 'Alicia', 'Paqui'],
    ['J. Eri', 'Luz', 'Vanessa'],
    ['Vanessa', 'Paqui', 'J. Fran']
  ],
  abajo: [
    ['Yolanda', 'Dori', 'Bibiana'],
    ['Tere', 'Belén', 'J. Manuel', 'Carmen'],
    ['Tere', 'Fany', 'Ester', 'Dori'],
    ['Belén', 'Ester', 'Fany', 'Carmen'],
    ['Yolanda', 'Bibiana', 'Danielle']
  ]
}

// Quienes pueden sustituir si no están en ningún patio ese día
export const DISPONIBLES = ['Paqui', 'Vanessa', 'Deli', 'Luz', 'Dori', 'Ester', 'Carmen', 'J. Manuel', 'Alicia', 'Belén', 'Fany', 'Bibiana', 'Tere', 'Yolanda']

export const quitaTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
