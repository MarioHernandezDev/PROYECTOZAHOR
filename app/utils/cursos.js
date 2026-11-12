// "4 PRIMARIA" -> "4º Primaria" · "1 ESO" -> "1º ESO" · "3 AÑOS" -> "3 años"  (acepta el curso o su nombre)
export const cursoLargo = (c) => {
  const n = typeof c === 'string' ? c : c?.nombre
  if (!n) return ''
  if (n.includes('PRIMARIA')) return n.replace(' PRIMARIA', 'º Primaria')
  if (n.includes('ESO')) return n.replace(' ESO', 'º ESO')
  return n.replace(' AÑOS', ' años')
}
