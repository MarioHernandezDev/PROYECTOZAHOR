// scripts/seed-excel.mjs
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL o SUPABASE_KEY no están configuradas en el .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runSeed() {
  console.log('🚀 Iniciando la migración completa desde AMBOS Excels a Supabase...')

  // 1. Limpiar tablas existentes en Supabase
  console.log('🧹 Limpiando base de datos previa...')
  await supabase.from('clases').delete().neq('id', 0)
  await supabase.from('profesores').delete().neq('id', 0)
  await supabase.from('cursos').delete().neq('id', 0)
  await supabase.from('asignaturas').delete().neq('id', 0)

  // 2. Crear Tramos Horarios (5 días x 6 horas = 30 tramos)
  console.log('⏰ Asegurando tramos horarios...')
  for (let dia = 1; dia <= 5; dia++) {
    for (let hora = 1; hora <= 6; hora++) {
      await supabase.from('tramos_horarios').upsert(
        { dia_semana: dia, hora_num: hora },
        { onConflict: 'dia_semana,hora_num' }
      )
    }
  }

  const { data: tramos } = await supabase.from('tramos_horarios').select('*')
  const tramoMap = {}
  tramos.forEach(t => {
    tramoMap[`${t.dia_semana}-${t.hora_num}`] = t.id
  })

  // 3. Crear / Mapear Cursos
  const listaCursos = ['1 ESO', '2 ESO', '1 PRIMARIA', '2 PRIMARIA', '3 PRIMARIA', '4 PRIMARIA', '5 PRIMARIA', '6 PRIMARIA', '3 AÑOS', '4 AÑOS', '5 AÑOS']
  const cursoMap = {}
  for (const c of listaCursos) {
    const etapa = c.includes('ESO') ? 'SECUNDARIA' : (c.includes('PRIMARIA') ? 'PRIMARIA' : 'INFANTIL')
    const { data } = await supabase.from('cursos').insert({ nombre: c, etapa }).select().single()
    if (data) cursoMap[c] = data.id
  }

  // Cache para asignaturas y profesores
  const asigMap = {}
  async function getOrCreateAsignatura(codigo) {
    if (!codigo) return null
    const codClean = String(codigo).trim().toUpperCase()
    if (asigMap[codClean]) return asigMap[codClean]

    const { data: existing } = await supabase.from('asignaturas').select('id').eq('codigo', codClean).maybeSingle()
    if (existing) {
      asigMap[codClean] = existing.id
      return existing.id
    }

    let color = '#3B82F6' // Azul por defecto
    if (codClean.includes('GUARDIA')) color = '#EAB308'
    if (codClean.includes('REFUERZO')) color = '#FACC15'
    if (codClean.includes('55 AÑOS') || codClean === 'HORARIO 0') color = '#9CA3AF'
    if (codClean.includes('MAT')) color = '#2563EB'
    if (codClean.includes('LENG') || codClean === 'L1' || codClean === 'L') color = '#EF4444'
    if (codClean === 'T' || codClean.includes('TUTORIA')) color = '#6B7280'
    if (codClean === 'EF') color = '#10B981'
    if (codClean === 'MU') color = '#8B5CF6'

    const { data: newAsig } = await supabase.from('asignaturas').insert({
      codigo: codClean,
      nombre: codClean,
      color_hex: color
    }).select().single()

    if (newAsig) {
      asigMap[codClean] = newAsig.id
      return newAsig.id
    }
    return null
  }

  const profMap = {}
  async function getOrCreateProfesor(nombre) {
    if (!nombre) return null
    const profClean = String(nombre).trim().toUpperCase()
    if (profMap[profClean]) return profMap[profClean]

    const { data: existing } = await supabase.from('profesores').select('id').eq('nombre', profClean).maybeSingle()
    if (existing) {
      profMap[profClean] = existing.id
      return existing.id
    }

    const { data: newProf } = await supabase.from('profesores').insert({ nombre: profClean }).select().single()
    if (newProf) {
      profMap[profClean] = newProf.id
      return newProf.id
    }
    return null
  }

  let totalClasesInsertadas = 0

  // -------------------------------------------------------------
  // PARTE A: PROCESAR HORARIO DE PROFESORES
  // -------------------------------------------------------------
  console.log('👨‍🏫 Procesando HORARIO_PROFESORES_2025-2026.xlsx...')
  const profExcelPath = path.join(__dirname, 'HORARIO_PROFESORES_2025-2026.xlsx')
  const profWB = XLSX.readFile(profExcelPath)
  const profData = XLSX.utils.sheet_to_json(profWB.Sheets[profWB.SheetNames[0]], { header: 1 })

  for (let rowIdx = 3; rowIdx < profData.length; rowIdx++) {
    const row = profData[rowIdx]
    if (!row || !row[0]) continue

    const profNombre = String(row[0]).trim().toUpperCase()
    if (profNombre.includes('HORARIO DE PROFESORES')) continue

    const profId = await getOrCreateProfesor(profNombre)

    for (let colIdx = 1; colIdx <= 30; colIdx++) {
      const celdaVal = row[colIdx]
      if (!celdaVal || String(celdaVal).trim() === '') continue

      const diaSemana = Math.floor((colIdx - 1) / 6) + 1
      const horaNum = ((colIdx - 1) % 6) + 1
      const tramoId = tramoMap[`${diaSemana}-${horaNum}`]
      const contenido = String(celdaVal).trim()

      if (contenido.includes('/')) {
        const partes = contenido.split('/').map(p => p.trim())
        for (let pos = 0; pos < partes.length; pos++) {
          const subTexto = partes[pos]
          if (!subTexto) continue
          const asigId = await getOrCreateAsignatura(subTexto)
          if (asigId && tramoId) {
            await supabase.from('clases').insert({
              profesor_id: profId,
              asignatura_id: asigId,
              tramo_id: tramoId,
              es_media_hora: true,
              posicion_media_hora: pos + 1
            })
            totalClasesInsertadas++
          }
        }
      } else {
        const asigId = await getOrCreateAsignatura(contenido)
        let cursoId = null
        for (const [nombreCurso, cId] of Object.entries(cursoMap)) {
          if (contenido.toUpperCase().includes(nombreCurso)) {
            cursoId = cId
            break
          }
        }

        if (asigId && tramoId) {
          await supabase.from('clases').insert({
            profesor_id: profId,
            curso_id: cursoId,
            asignatura_id: asigId,
            tramo_id: tramoId,
            es_media_hora: false
          })
          totalClasesInsertadas++
        }
      }
    }
  }

  // -------------------------------------------------------------
  // PARTE B: PROCESAR HORARIO DE AULAS / CURSOS
  // -------------------------------------------------------------
  console.log('🏫 Procesando HORARIO_AULAS_2025-2026.xlsx...')
  const aulasExcelPath = path.join(__dirname, 'HORARIO_AULAS_2025-2026.xlsx')
  const aulasWB = XLSX.readFile(aulasExcelPath)
  const aulasData = XLSX.utils.sheet_to_json(aulasWB.Sheets[aulasWB.SheetNames[0]], { header: 1 })

  for (let rowIdx = 3; rowIdx < aulasData.length; rowIdx++) {
    const row = aulasData[rowIdx]
    if (!row || !row[0]) continue

    const aulaNombre = String(row[0]).trim().toUpperCase()
    
    // Buscar coincidencia de curso (ej: "3 PRIMARIA")
    let cursoId = null
    for (const [nombreCurso, cId] of Object.entries(cursoMap)) {
      if (aulaNombre.includes(nombreCurso)) {
        cursoId = cId
        break
      }
    }

    if (!cursoId) continue

    for (let colIdx = 1; colIdx <= 30; colIdx++) {
      const celdaVal = row[colIdx]
      if (!celdaVal || String(celdaVal).trim() === '') continue

      const diaSemana = Math.floor((colIdx - 1) / 6) + 1
      const horaNum = ((colIdx - 1) % 6) + 1
      const tramoId = tramoMap[`${diaSemana}-${horaNum}`]
      const contenido = String(celdaVal).trim()

      if (contenido.includes('/')) {
        const partes = contenido.split('/').map(p => p.trim())
        for (let pos = 0; pos < partes.length; pos++) {
          const subTexto = partes[pos]
          if (!subTexto) continue
          const asigId = await getOrCreateAsignatura(subTexto)
          if (asigId && tramoId) {
            await supabase.from('clases').insert({
              curso_id: cursoId,
              asignatura_id: asigId,
              tramo_id: tramoId,
              es_media_hora: true,
              posicion_media_hora: pos + 1
            })
            totalClasesInsertadas++
          }
        }
      } else {
        const asigId = await getOrCreateAsignatura(contenido)
        if (asigId && tramoId) {
          await supabase.from('clases').insert({
            curso_id: cursoId,
            asignatura_id: asigId,
            tramo_id: tramoId,
            es_media_hora: false
          })
          totalClasesInsertadas++
        }
      }
    }
  }

  console.log(`✅ ¡Proceso finalizado con éxito!`)
  console.log(`📊 Se han importado correctamente ambos archivos y un total de ${totalClasesInsertadas} celdas/sesiones en Supabase.`)
}

runSeed().catch(err => {
  console.error('❌ Error durante la migración:', err)
})