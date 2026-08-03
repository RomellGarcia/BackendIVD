import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'
import { sendResultadosPublicadosEmail, sendResultadosPublicadosClubEmail } from '../services/email.service.js'

// Disciplinas de campo (salto/lanzamiento) gana la marca MÁS ALTA.
// Las demás (carreras, vallas, marcha, relevos) son por tiempo: gana la MÁS BAJA.
const DISCIPLINAS_DISTANCIA = new Set([
  'Salto de longitud',
  'Salto de altura',
  'Lanzamiento de bala',
  'Lanzamiento de disco',
  'Lanzamiento de jabalina',
])
const esDisciplinaDeDistancia = (disciplina) => DISCIPLINAS_DISTANCIA.has((disciplina || '').trim())

// Convierte tiempo en formato "01:02:17,45" a centésimas para comparar numéricamente
const tiempoACentesimas = (str) => {
  if (!str) return null
  const limpio = String(str).trim().replace(',', '.')
  const partes = limpio.split(':').map((p) => parseFloat(p))
  if (partes.some((p) => Number.isNaN(p))) return null
  let segundos = 0
  if (partes.length === 3) segundos = partes[0] * 3600 + partes[1] * 60 + partes[2]
  else if (partes.length === 2) segundos = partes[0] * 60 + partes[1]
  else if (partes.length === 1) segundos = partes[0]
  else return null
  return Math.round(segundos * 100)
}

// Convierte marca de distancia como "6,45 m" a número
const marcaANumero = (str) => {
  if (!str) return null
  const num = parseFloat(String(str).trim().replace(',', '.').replace(/[^0-9.]/g, ''))
  return Number.isNaN(num) ? null : num
}

// Calcula posiciones (con empates) para resultados de una misma convocatoria
const calcularPosiciones = (resultados, disciplina) => {
  const esDistancia = esDisciplinaDeDistancia(disciplina)

  const valorDe = (r) => {
    const prueba = esDistancia
      ? r.pruebas?.find((p) => p.nombre === 'Marca')
      : r.pruebas?.find((p) => p.nombre === 'ChipTime')
    return esDistancia ? marcaANumero(prueba?.marca) : tiempoACentesimas(prueba?.marca)
  }

  const resultadosConValor = resultados.map((r) => ({ ...r, _valorOrden: valorDe(r) }))

  resultadosConValor.sort((a, b) => {
    if (a._valorOrden === null && b._valorOrden === null) return 0
    if (a._valorOrden === null) return 1
    if (b._valorOrden === null) return -1
    return esDistancia ? b._valorOrden - a._valorOrden : a._valorOrden - b._valorOrden
  })

  let siguientePosicion = 1
  resultadosConValor.forEach((r, i) => {
    if (r._valorOrden === null) { r.posicion = null; return }
    if (i > 0 && resultadosConValor[i - 1]._valorOrden === r._valorOrden) {
      r.posicion = resultadosConValor[i - 1].posicion
    } else {
      r.posicion = siguientePosicion
    }
    siguientePosicion = i + 2
    delete r._valorOrden
  })

  return resultadosConValor
}

// Query base con JOINs para obtener resultados completos (incluye pruebas y bib)
const RESULTADO_BASE = `
  SELECT
    r.id, r.ano_competitivo, r.fecha_registro,
    r.evento_id, e.titulo AS evento_titulo, e.fecha AS evento_fecha, e.lugar AS evento_lugar,
    e.imagen_url AS evento_imagen_url,
    conv.id AS convocatoria_id,
    u.nombre, u.apellido_paterno, u.apellido_materno,
    a.id AS atleta_id, a.municipio, a.lugar_entrenamiento, a.club_id,
    c_atleta.nombre AS club_nombre,
    ue.nombre AS entrenador_nombre,
    ue.apellido_paterno AS entrenador_apellido,
    en.id AS entrenador_id,
    r.categoria_id, cat.nombre AS categoria,
    r.genero_id, g.nombre AS genero,
    r.disciplina_id, d.nombre AS disciplina,
    i.bib,
    COALESCE(
      JSON_AGG(
        jsonb_build_object(
          'id',     pr.id,
          'nombre', pr.nombre,
          'marca',  pr.marca,
          'unidad', pr.unidad
        )
      ) FILTER (WHERE pr.id IS NOT NULL), '[]'
    ) AS pruebas
  FROM resultados r
  JOIN eventos e        ON r.evento_id = e.id
  JOIN atletas a        ON r.atleta_id = a.id
  JOIN usuarios u       ON a.usuario_id = u.id
  LEFT JOIN clubes c_atleta    ON a.club_id = c_atleta.id
  LEFT JOIN entrenadores en    ON r.entrenador_id = en.id
  LEFT JOIN usuarios ue        ON en.usuario_id = ue.id
  LEFT JOIN categorias cat     ON r.categoria_id = cat.id
  LEFT JOIN generos g          ON r.genero_id = g.id
  LEFT JOIN disciplinas d      ON r.disciplina_id = d.id
  LEFT JOIN convocatorias conv ON conv.evento_id = r.evento_id AND conv.disciplina_id = r.disciplina_id
                                AND conv.categoria_id = r.categoria_id AND conv.genero_id = r.genero_id
  LEFT JOIN inscripciones i    ON i.convocatoria_id = conv.id AND i.atleta_id = r.atleta_id
  LEFT JOIN pruebas_resultado pr ON pr.resultado_id = r.id
`

const RESULTADO_GROUP = `
  GROUP BY
    r.id, r.ano_competitivo, r.fecha_registro, r.evento_id, e.titulo, e.fecha, e.lugar, e.imagen_url,
    conv.id,
    u.nombre, u.apellido_paterno, u.apellido_materno,
    a.id, a.municipio, a.lugar_entrenamiento, a.club_id,
    c_atleta.nombre, ue.nombre, ue.apellido_paterno,
    en.id, r.categoria_id, cat.nombre, r.genero_id, g.nombre, r.disciplina_id, d.nombre, i.bib
`

// Dado un conjunto de resultados propios, calcula la posición real de cada uno comparando contra todo el campo de su convocatoria
const agregarPosicionesReales = async (resultadosPropios) => {
  const cachePorCampo = new Map() 
  const conPosicion = []

  for (const propio of resultadosPropios) {
    const clave = `${propio.evento_id}-${propio.disciplina_id}-${propio.categoria_id}-${propio.genero_id}`
    if (!cachePorCampo.has(clave)) {
      const { rows: campoCompleto } = await pool.query(
        `${RESULTADO_BASE}
         WHERE r.evento_id = $1 AND r.disciplina_id = $2 AND r.categoria_id = $3 AND r.genero_id = $4
         ${RESULTADO_GROUP}`,
        [propio.evento_id, propio.disciplina_id, propio.categoria_id, propio.genero_id]
      )
      cachePorCampo.set(clave, calcularPosiciones(campoCompleto, campoCompleto[0]?.disciplina))
    }
    const campoRankeado = cachePorCampo.get(clave)
    const conRanking = campoRankeado.find((r) => r.id === propio.id)
    conPosicion.push(conRanking || { ...propio, posicion: null })
  }

  return conPosicion
}

// Lista resultados con filtros opcionales
export const findAll = async ({ eventoId, atletaId, categoriaId, clubId, anoCompetitivo, limit = 100 } = {}) => {
  const params = []
  const conditions = []

  if (eventoId) { params.push(eventoId); conditions.push(`r.evento_id = $${params.length}`) }
  if (atletaId) { params.push(atletaId); conditions.push(`r.atleta_id = $${params.length}`) }
  if (categoriaId) { params.push(categoriaId); conditions.push(`r.categoria_id = $${params.length}`) }
  if (clubId) { params.push(clubId); conditions.push(`a.club_id = $${params.length}`) }
  if (anoCompetitivo) { params.push(anoCompetitivo); conditions.push(`r.ano_competitivo = $${params.length}`) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit)

  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     ${where}
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC
     LIMIT $${params.length}`,
    params
  )
  return agregarPosicionesReales(rows)
}

// Obtiene un resultado por ID
export const findById = async (id) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.id = $1
     ${RESULTADO_GROUP}`,
    [id]
  )
  return rows[0] || null
}

// Resultados por evento
export const findByEvento = async (eventoId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.evento_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [eventoId]
  )
  return rows
}

// Resultados por atleta (con posición real)
export const findByAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.atleta_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [atletaId]
  )
  return agregarPosicionesReales(rows)
}

// Resultados por club (con posición real)
export const findByClub = async (clubId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE a.club_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [clubId]
  )
  return agregarPosicionesReales(rows)
}

// Resultados por entrenador (con posición real)
export const findByEntrenador = async (entrenadorId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.entrenador_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [entrenadorId]
  )
  return agregarPosicionesReales(rows)
}

// Crea un resultado y sus pruebas asociadas (transacción)
export const create = async ({
  evento_id, atleta_id, entrenador_id,
  categoria_id, genero_id, disciplina_id,
  ano_competitivo, pruebas = []
}) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO resultados
        (evento_id, atleta_id, entrenador_id, categoria_id, genero_id, disciplina_id, ano_competitivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [evento_id, atleta_id, entrenador_id ?? null, categoria_id ?? null,
       genero_id ?? null, disciplina_id ?? null, ano_competitivo ?? new Date().getFullYear()]
    )
    const resultado = rows[0]

    for (const prueba of pruebas) {
      await client.query(
        `INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad)
         VALUES ($1, $2, $3, $4)`,
        [resultado.id, prueba.nombre, prueba.marca, prueba.unidad || null]
      )
    }

    await client.query('COMMIT')
    return await findById(resultado.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Actualiza un resultado y reemplaza sus pruebas
export const update = async (id, {
  evento_id, atleta_id, entrenador_id,
  categoria_id, genero_id, disciplina_id,
  ano_competitivo, pruebas
}) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `UPDATE resultados SET
        evento_id       = COALESCE($1, evento_id),
        atleta_id       = COALESCE($2, atleta_id),
        entrenador_id   = COALESCE($3, entrenador_id),
        categoria_id    = COALESCE($4, categoria_id),
        genero_id       = COALESCE($5, genero_id),
        disciplina_id   = COALESCE($6, disciplina_id),
        ano_competitivo = COALESCE($7, ano_competitivo)
       WHERE id = $8
       RETURNING *`,
      [evento_id, atleta_id, entrenador_id,
       categoria_id, genero_id, disciplina_id,
       ano_competitivo, id]
    )
    if (!rows[0]) { await client.query('ROLLBACK'); return null }

    if (pruebas !== undefined) {
      await client.query(`DELETE FROM pruebas_resultado WHERE resultado_id = $1`, [id])
      for (const prueba of pruebas) {
        await client.query(
          `INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad)
           VALUES ($1, $2, $3, $4)`,
          [id, prueba.nombre, prueba.marca, prueba.unidad || null]
        )
      }
    }

    await client.query('COMMIT')
    return await findById(id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Elimina un resultado (las pruebas se eliminan por cascada FK)
export const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM resultados WHERE id = $1 RETURNING id`,
    [id]
  )
  return rows[0] || null
}

// Estadísticas generales
export const getEstadisticasGenerales = async () => {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*)                          AS total_resultados,
      COUNT(DISTINCT r.evento_id)       AS total_eventos,
      COUNT(DISTINCT r.atleta_id)       AS total_atletas,
      COUNT(DISTINCT a.club_id)         AS total_clubes,
      COUNT(DISTINCT r.categoria_id)    AS total_categorias
     FROM resultados r
     JOIN atletas a ON r.atleta_id = a.id`
  )
  return rows[0]
}

// Estadísticas por club
export const getEstadisticasByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT
      COUNT(*)                        AS total_resultados,
      COUNT(DISTINCT r.atleta_id)     AS total_atletas,
      COUNT(DISTINCT r.evento_id)     AS total_eventos,
      COUNT(DISTINCT r.categoria_id)  AS total_categorias
     FROM resultados r
     JOIN atletas a ON r.atleta_id = a.id
     WHERE a.club_id = $1`,
    [clubId]
  )
  return rows[0]
}

// Obtiene los datos de una convocatoria
const resolverConvocatoria = async (client, convocatoriaId) => {
  const { rows } = await client.query(
    `SELECT evento_id, disciplina_id, categoria_id, genero_id FROM convocatorias WHERE id = $1`,
    [convocatoriaId]
  )
  return rows[0] || null
}

// Obtiene las mejores marcas por disciplina, categoría y género
export const getMejoresMarcas = async ({ categoria, disciplina, club, anoCompetitivo, genero } = {}) => {
  const params = []
  const conditions = []
  if (categoria) { params.push(categoria); conditions.push(`cat.nombre = $${params.length}`) }
  if (disciplina) { params.push(disciplina); conditions.push(`d.nombre = $${params.length}`) }
  if (club) { params.push(club); conditions.push(`c_atleta.nombre = $${params.length}`) }
  if (anoCompetitivo) { params.push(anoCompetitivo); conditions.push(`r.ano_competitivo = $${params.length}`) }
  if (genero) { params.push(genero); conditions.push(`g.nombre ILIKE $${params.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     ${where}
     ${RESULTADO_GROUP}`,
    params
  )

  const agrupadoPorCampo = new Map()
  for (const r of rows) {
    if (!r.disciplina) continue
    const esDistancia = esDisciplinaDeDistancia(r.disciplina)
    const prueba = esDistancia
      ? r.pruebas?.find((p) => p.nombre === 'Marca')
      : r.pruebas?.find((p) => p.nombre === 'ChipTime') || r.pruebas?.find((p) => p.nombre === 'GunTime')
    const valor = prueba ? (esDistancia ? marcaANumero(prueba.marca) : tiempoACentesimas(prueba.marca)) : null
    if (valor === null) continue
    const texto = `${prueba.marca}${prueba.unidad ? ' ' + prueba.unidad : ''}`.trim()

    const clave = `${r.disciplina_id}|${r.categoria_id}|${r.genero_id}`
    if (!agrupadoPorCampo.has(clave)) {
      agrupadoPorCampo.set(clave, {
        disciplina: r.disciplina, categoria: r.categoria || '—', genero: r.genero || '—',
        esDistancia, atletas: [],
      })
    }
    agrupadoPorCampo.get(clave).atletas.push({
      atleta_id: r.atleta_id,
      nombre: [r.nombre, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' '),
      club_nombre: r.club_nombre || 'Independiente',
      evento_titulo: r.evento_titulo,
      valor, texto,
    })
  }

  return [...agrupadoPorCampo.values()]
    .map((combo) => {
      const atletasOrdenados = combo.atletas.sort((a, b) => combo.esDistancia ? b.valor - a.valor : a.valor - b.valor)
      return {
        disciplina: combo.disciplina, categoria: combo.categoria, genero: combo.genero,
        mejorAtleta: atletasOrdenados[0],
        candidatos: atletasOrdenados.slice(0, 5),
        totalCandidatos: atletasOrdenados.length,
      }
    })
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina) || a.categoria.localeCompare(b.categoria))
}

// Resultados de una convocatoria específica (con posiciones calculadas)
export const findByConvocatoria = async (convocatoriaId) => {
  const conv = await resolverConvocatoria(pool, convocatoriaId)
  if (!conv) return null

  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.evento_id = $1 AND r.disciplina_id = $2 AND r.categoria_id = $3 AND r.genero_id = $4
     ${RESULTADO_GROUP}`,
    [conv.evento_id, conv.disciplina_id, conv.categoria_id, conv.genero_id]
  )
  return calcularPosiciones(rows, rows[0]?.disciplina)
}

// Elimina todos los resultados de una convocatoria (incluye sus pruebas)
export const removeByConvocatoria = async (convocatoriaId) => {
  const conv = await resolverConvocatoria(pool, convocatoriaId)
  if (!conv) return null

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: aBorrar } = await client.query(
      `SELECT id FROM resultados
       WHERE evento_id = $1 AND disciplina_id = $2 AND categoria_id = $3 AND genero_id = $4`,
      [conv.evento_id, conv.disciplina_id, conv.categoria_id, conv.genero_id]
    )
    const ids = aBorrar.map((r) => r.id)

    if (ids.length > 0) {
      await client.query(`DELETE FROM pruebas_resultado WHERE resultado_id = ANY($1::int[])`, [ids])
      await client.query(`DELETE FROM resultados WHERE id = ANY($1::int[])`, [ids])
    }

    await client.query('COMMIT')
    return ids.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Carga masiva de resultados para una convocatoria (reemplaza los existentes)
export const createMasivoPorConvocatoria = async (convocatoriaId, atletasResultados, anoCompetitivo) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const conv = await resolverConvocatoria(client, convocatoriaId)
    if (!conv) { await client.query('ROLLBACK'); return null }

    // Eliminar resultados previos de esta convocatoria
    const { rows: aBorrar } = await client.query(
      `SELECT id FROM resultados
       WHERE evento_id = $1 AND disciplina_id = $2 AND categoria_id = $3 AND genero_id = $4`,
      [conv.evento_id, conv.disciplina_id, conv.categoria_id, conv.genero_id]
    )
    const idsPrevios = aBorrar.map((r) => r.id)
    if (idsPrevios.length > 0) {
      await client.query(`DELETE FROM pruebas_resultado WHERE resultado_id = ANY($1::int[])`, [idsPrevios])
      await client.query(`DELETE FROM resultados WHERE id = ANY($1::int[])`, [idsPrevios])
    }

    // Insertar nuevos resultados
    const idsCreados = []
    for (const r of atletasResultados) {
      const { rows } = await client.query(
        `INSERT INTO resultados
          (evento_id, atleta_id, categoria_id, genero_id, disciplina_id, ano_competitivo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          conv.evento_id, r.atleta_id, conv.categoria_id, conv.genero_id, conv.disciplina_id,
          anoCompetitivo ?? new Date().getFullYear(),
        ]
      )
      const resultadoId = rows[0].id

      for (const prueba of (r.pruebas || [])) {
        await client.query(
          `INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad)
           VALUES ($1, $2, $3, $4)`,
          [resultadoId, prueba.nombre, prueba.marca, prueba.unidad || null]
        )
      }
      idsCreados.push(resultadoId)
    }

    await client.query('COMMIT')

    // Notificar a atletas y clubes sobre la publicación de resultados
    try {
      const { rows: infoEvento } = await pool.query(
        `SELECT e.titulo AS evento_titulo, d.nombre AS disciplina, cat.nombre AS categoria
         FROM eventos e
         JOIN disciplinas d  ON d.id = $1
         JOIN categorias cat ON cat.id = $2
         WHERE e.id = $3`,
        [conv.disciplina_id, conv.categoria_id, conv.evento_id]
      )
      const info = infoEvento[0]
      if (info && idsCreados.length > 0) {
        const { rows: atletasUsuarios } = await pool.query(
          `SELECT u.id AS usuario_id, u.nombre, u.email,
                  cl.id AS club_id, cl.email AS club_email, cl.nombre AS club_nombre
           FROM resultados r
           JOIN atletas a       ON r.atleta_id = a.id
           JOIN usuarios u      ON a.usuario_id = u.id
           LEFT JOIN clubes cl  ON a.club_id = cl.id
           WHERE r.id = ANY($1::int[])`,
          [idsCreados]
        )
        const mensaje = `Ya están los resultados de "${info.disciplina} - ${info.categoria}" del evento "${info.evento_titulo}".`
        await NotificacionModel.crearParaVarios(atletasUsuarios.map((a) => a.usuario_id), mensaje)

        const clubesUnicos = [...new Map(
          atletasUsuarios.filter((a) => a.club_id).map((a) => [a.club_id, a])
        ).values()]
        for (const club of clubesUnicos) {
          await NotificacionModel.crearParaClub(club.club_id, mensaje)
        }

        for (const a of atletasUsuarios) {
          await sendResultadosPublicadosEmail({
            to: a.email, nombre: a.nombre,
            disciplina: info.disciplina, categoria: info.categoria, eventoTitulo: info.evento_titulo,
          }).catch((err) => console.error(`No se pudo enviar el correo de resultados a ${a.email}:`, err))
        }
        for (const club of clubesUnicos) {
          const atletasDelClub = atletasUsuarios.filter((a) => a.club_id === club.club_id).map((a) => a.nombre)
          await sendResultadosPublicadosClubEmail({
            to: club.club_email, clubNombre: club.club_nombre,
            disciplina: info.disciplina, categoria: info.categoria, eventoTitulo: info.evento_titulo,
            atletas: atletasDelClub,
          }).catch((err) => console.error(`No se pudo enviar el correo de resultados al club ${club.club_email}:`, err))
        }
      }
    } catch (err) {
      console.error('No se pudo notificar la publicación de resultados:', err)
    }

    return idsCreados
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}