// Carga el horario 2026/27 + teléfonos en Supabase. Uso: node scripts/seed-2026.mjs [--dry]
// Reemplaza clases, profesores y asignaturas. Mantiene cursos y tramos.
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PROFES } from './horario-2026.mjs'

dotenv.config()
const DRY = process.argv.includes('--dry')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY)

// ---------- catálogo de asignaturas ----------
const MAT = {
  LC: ['Lengua', '#EF4444'], MAT: ['Matemáticas', '#2563EB'], CM: ['Conocimiento del Medio', '#16A34A'],
  AR: ['Artística', '#EC4899'], EF: ['Educación Física', '#10B981'], MU: ['Música', '#8B5CF6'],
  ING: ['Inglés', '#0EA5E9'], FR: ['Francés', '#6366F1'], FQ: ['Física y Química', '#0D9488'],
  BG: ['Biología y Geología', '#65A30D'], GH: ['Geografía e Historia', '#D97706'], TEC: ['Tecnología', '#475569'],
  TA: ['TA', '#64748B'], TP: ['TP', '#64748B'], OD: ['OD', '#64748B'], VC: ['Valores Cívicos', '#F97316'],
  PL: ['Plástica', '#EC4899'], RG: ['Religión', '#A16207'], PT: ['Pedagogía Terapéutica', '#14B8A6'],
  RP: ['Refuerzo pedagógico', '#FACC15'], ATED: ['Atención educativa', '#94A3B8'], DESD: ['Desdoble', '#38BDF8'],
  STEAM: ['STEAM', '#7C3AED'], BBL: ['Biblioteca', '#B45309'], TDE: ['Transformación Digital', '#0891B2'],
  CORD: ['Coordinación', '#6B7280'], FD: ['Función directiva', '#6B7280'], '55': ['Reducción +55', '#9CA3AF'],
  GUARDIA: ['Guardia', '#EAB308'], INFANTIL: ['Infantil', '#F472B6'], EIPT: ['Educación Infantil (PT)', '#14B8A6'],
}
const ALIAS = { G: 'GUARDIA', TC: 'TEC', MATE: 'MAT', ATD: 'ATED', COORD: 'CORD', DESDOBLE: 'DESD', ART: 'AR' }
const ESO_ONLY = new Set(['GH', 'TEC', 'FQ', 'BG', 'TA', 'PL', 'FR', 'OD', 'RG'])

// "2ºS Mat" -> { cursos:['2 ESO'], asig:'MAT' }
function parseCelda(txt, subjDefault) {
  let t = txt.trim()
  if (!t) return null
  if (/^\d{2}$/.test(t)) return { cursos: [], asig: t }            // "55"
  t = t.replace(/º\s+([PS])\b/gi, 'º$1').replace(/,/g, ' ')
  const cursos = [], subj = []
  for (const tok of t.split(/\s+/)) {
    if (/^(\d)A(Ñ|ÑOS)?$/i.test(tok)) { cursos.push(`${tok[0]} AÑOS`); continue }
    if (/^(\d\s*º?\s*[PS]?)+$/i.test(tok)) {
      for (const c of tok.matchAll(/(\d)º?([PS])?/gi)) cursos.push([c[1], (c[2] || '').toUpperCase()])
      continue
    }
    subj.push(tok)
  }
  let nota = null
  const hh = subj.findIndex(x => /^\d{1,2}[:,.]\d{2}$/.test(x))
  if (hh >= 0) { nota = 'desde las ' + subj[hh].replace(/[,.]/, ':'); subj.splice(hh, 1) }
  let code = subj.join('').toUpperCase().replace(/\./g, '')
  code = ALIAS[code] || code
  if (/^AT[ED]/.test(code)) code = 'ATED'
  if (!code) code = subjDefault || 'INFANTIL'
  const eso = ESO_ONLY.has(code)
  const nombres = cursos.map(c => typeof c === 'string' ? c
    : c[1] === 'S' ? `${c[0]} ESO` : c[1] === 'P' ? `${c[0]} PRIMARIA` : `${c[0]} ${eso ? 'ESO' : 'PRIMARIA'}`)
  return { cursos: nombres, asig: code, nota }
}

// ---------- teléfonos ----------
function leerMoviles() {
  const raw = fs.readFileSync(path.join(__dirname, '../context/moviles.csv'))
  const txt = new TextDecoder('latin1').decode(raw)
  const res = {}
  for (const l of txt.split(/\r?\n/).slice(1)) {
    const nombre = l.replace(/^"/, '').split(/,\s*"{1,2}/)[0].trim()
    const num = (l.match(/(?:\+?34)?[\s]*([6-9](?:[\s.-]?\d){8})/) || [])[1]
    if (nombre && num) res[nombre] = '34' + num.replace(/\D/g, '')
  }
  return res
}

async function main() {
  const moviles = leerMoviles()
  const { data: tramos } = await sb.from('tramos_horarios').select('*')
  const tramoId = {}; tramos.forEach(t => (tramoId[`${t.dia_semana}-${t.hora_num}`] = t.id))
  const { data: cursos } = await sb.from('cursos').select('*')
  const cursoId = {}; cursos.forEach(c => (cursoId[c.nombre] = c.id))

  const filas = []   // { prof, cursoNombre|null, asig, dia, hora, nota }
  const avisos = []
  for (const [corto, completo, horario, defMat] of PROFES) {
    const celdas = horario ? horario.split('|') : []
    celdas.forEach((txt, i) => {
      const p = parseCelda(txt, defMat)
      if (!p) return
      const dia = Math.floor(i / 6) + 1, hora = (i % 6) + 1
      if (!MAT[p.asig]) avisos.push(`${corto} d${dia}h${hora}: materia desconocida "${p.asig}" de "${txt}"`)
      for (const c of p.cursos.length ? p.cursos : [null]) {
        if (c && !cursoId[c]) avisos.push(`${corto} d${dia}h${hora}: curso desconocido "${c}" de "${txt}"`)
        filas.push({ prof: corto, curso: c, asig: p.asig, dia, hora, nota: p.nota })
      }
    })
    if (!moviles[completo]) avisos.push(`Sin teléfono: ${corto} (${completo})`)
  }
  console.log(`Filas de clase: ${filas.length}`)
  avisos.forEach(a => console.log('⚠', a))
  if (DRY) {
    const resumen = {}; filas.forEach(f => (resumen[f.asig] = (resumen[f.asig] || 0) + 1)); console.log(resumen)
    return
  }

  console.log('🧹 Limpiando…')
  await sb.from('clases').delete().neq('id', 0)
  await sb.from('profesores').delete().neq('id', 0)
  await sb.from('asignaturas').delete().neq('id', 0)

  const { data: asigs, error: e1 } = await sb.from('asignaturas')
    .insert(Object.entries(MAT).map(([codigo, [nombre, color_hex]]) => ({ codigo, nombre, color_hex }))).select()
  if (e1) throw e1
  const asigId = {}; asigs.forEach(a => (asigId[a.codigo] = a.id))

  const { data: profs, error: e2 } = await sb.from('profesores')
    .insert(PROFES.map(([nombre, nombre_completo]) => ({ nombre, nombre_completo, telefono: moviles[nombre_completo] || null }))).select()
  if (e2) throw e2
  const profId = {}; profs.forEach(p => (profId[p.nombre] = p.id))

  const rows = filas.map(f => ({
    profesor_id: profId[f.prof], curso_id: f.curso ? cursoId[f.curso] : null,
    asignatura_id: asigId[f.asig] || null, tramo_id: tramoId[`${f.dia}-${f.hora}`], es_media_hora: false, nota: f.nota || null,
  }))
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('clases').insert(rows.slice(i, i + 200))
    if (error) throw error
  }
  console.log(`✅ ${profs.length} profesores, ${asigs.length} asignaturas, ${rows.length} clases`)
}
main().catch(e => { console.error('❌', e); process.exit(1) })
