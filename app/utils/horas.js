// Horario real del CEIP El Zahor. Las sesiones 1-6 son las mismas para todos, cambia la hora de entrada/salida.
// Secundaria 8:00-14:30 · Primaria/Infantil 9:00-14:00 (6ª sesión de 30 min) · Recreo 11:00-11:30 para todos.
const SEC = { 1: ['8:00', '9:00'], 2: ['9:00', '10:00'], 3: ['10:00', '11:00'], 4: ['11:30', '12:30'], 5: ['12:30', '13:30'], 6: ['13:30', '14:30'] }
const PRI = { 1: null, 2: ['9:00', '10:00'], 3: ['10:00', '11:00'], 4: ['11:30', '12:30'], 5: ['12:30', '13:30'], 6: ['13:30', '14:00'] }

// etapa: 'SECUNDARIA' | 'PRIMARIA' | 'INFANTIL'  →  "11:30–12:30" o null si esa etapa no tiene clase esa hora
export const horaRango = (hora, etapa) => {
  const r = (etapa === 'SECUNDARIA' ? SEC : PRI)[hora]
  return r ? `${r[0]}–${r[1]}` : null
}
// Materias que son "apoyo" dentro de un aula: pueden coincidir con la clase del tutor sin que sea un choque
export const CODIGOS_APOYO = ['RP', 'PT', 'DESD', 'ATED', 'RG', 'EIPT', 'GUARDIA', '55', 'CORD', 'FD', 'TDE', 'STEAM', 'BBL']
