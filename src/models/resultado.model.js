import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'
import { sendResultadosPublicadosEmail, sendResultadosPublicadosClubEmail } from '../services/email.service.js'

// Disciplinas de campo (salto/lanzamiento): gana la marca MÁS ALTA. Todo lo
// demás del catálogo (carreras, vallas, marcha, relevos) es por tiempo:
// gana la MÁS BAJA. Si agregas una disciplina de distancia nueva al
// catálogo, agrégala aquí también para que el lugar salga bien calculado.
const DISCIPLINAS_DISTANCIA = new Set([
  'Salto de longitud',
  'Salto de altura',
  'Lanzamiento de bala',
  'Lanzamiento de disco',
  'Lanzamiento de jabalina',
])
const esDisciplinaDeDistancia = (disciplina) => DISCIPLINAS_DISTANCIA.has((disciplina || '').trim())

// "01:02:17,45" / "62:17,45" / "17,45" → total de centésimas, para poder
// comparar tiempos como números. null si no se puede interpretar.
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

// "6,45 m" / "6.45" → número, para comparar distancias/alturas.
const marcaANumero = (str) => {
  if (!str) return null
  const num = parseFloat(String(str).trim().replace(',', '.').replace(/[^0-9.]/g, ''))
  return Number.isNaN(num) ? null : num
}

// Recibe TODOS los resultados de un mismo campo (evento+disciplina+
// categoría+género — es decir, de una convocatoria) y regresa la misma
// lista con `posicion` agregado a cada uno (1, 2, 3...). Empates comparten
// lugar. Los que no tengan una marca válida quedan sin posición (null).
const calcularPosiciones = (resultados, disciplina) => {
  const esDistancia = esDisciplinaDeDistancia(disciplina)

  const valorDe = (r) => {
    const prueba = esDistancia
      ? r.pruebas?.find((p) => p.nombre === 'Marca')
      : r.pruebas?.find((p) => p.nombre === 'ChipTime')
    return esDistancia ? marcaANumero(prueba?.marca) : tiempoACentesimas(prueba?.marca)
  }

  const conValor = resultados.map((r) => ({ ...r, _valorOrden: valorDe(r) }))

  conValor.sort((a, b) => {
    if (a._valorOrden === null && b._valorOrden === null) return 0
    if (a._valorOrden === null) return 1
    if (b._valorOrden === null) return -1
    return esDistancia ? b._valorOrden - a._valorOrden : a._valorOrden - b._valorOrden
  })

  let siguientePosicion = 1
  conValor.forEach((r, i) => {
    if (r._valorOrden === null) { r.posicion = null; return }
    if (i > 0 && conValor[i - 1]._valorOrden === r._valorOrden) {
      r.posicion = conValor[i - 1].posicion
    } else {
      r.posicion = siguientePosicion
    }
    siguientePosicion = i + 2
    delete r._valorOrden
  })

  return conValor
}

//Query base reutilizable para traer resultados con JOINs. Trae el Bib
//cruzando por evento+disciplina+categoría+género hacia convocatorias, y de
//ahí hacia la inscripción de ese mismo atleta (el Bib vive en
//inscripciones, no en resultados).
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

// Dado un conjunto de resultados (de un atleta o de un club), calcula el
// lugar real de cada uno comparándolo contra TODO el campo de esa
// convocatoria (evento+disciplina+categoría+género) — nunca solo contra
// los resultados propios, porque el lugar de un atleta no depende
// únicamente de sus compañeros de club.
const agregarPosicionesReales = async (resultadosPropios) => {
  const combosVistos = new Map() // clave del campo -> ese campo completo, ya rankeado
  const conPosicion = []

  for (const propio of resultadosPropios) {
    const clave = `${propio.evento_id}-${propio.disciplina_id}-${propio.categoria_id}-${propio.genero_id}`
    if (!combosVistos.has(clave)) {
      const { rows: campoCompleto } = await pool.query(
        `${RESULTADO_BASE}
         WHERE r.evento_id = $1 AND r.disciplina_id = $2 AND r.categoria_id = $3 AND r.genero_id = $4
         ${RESULTADO_GROUP}`,
        [propio.evento_id, propio.disciplina_id, propio.categoria_id, propio.genero_id]
      )
      combosVistos.set(clave, calcularPosiciones(campoCompleto, campoCompleto[0]?.disciplina))
    }
    const campoRankeado = combosVistos.get(clave)
    const conRanking = campoRankeado.find((r) => r.id === propio.id)
    conPosicion.push(conRanking || { ...propio, posicion: null })
  }

  return conPosicion
}

//Obtener todos con filtros opcionales
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
  // Igual que findByAtleta/findByClub: el lugar de cada resultado se
  // calcula contra TODO el campo de su convocatoria (evento+disciplina+
  // categoría+género), no nada más entre los que trajo este LIMIT.
  return agregarPosicionesReales(rows)
}

//Un resultado por ID
export const findById = async (id) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.id = $1
     ${RESULTADO_GROUP}`,
    [id]
  )
  return rows[0] || null
}

//Resultados por evento
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

//Resultados por atleta — con el lugar real ya calculado contra todo el
//campo de cada convocatoria en la que participó, y su Bib.
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

//Resultados por club — con el lugar real de cada atleta ya calculado
//contra todo el campo de cada convocatoria, y su Bib.
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

//Resultados por entrenador
export const findByEntrenador = async (entrenadorId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.entrenador_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [entrenadorId]
  )
  // Mismo fix que en findAll: esta consulta tampoco calculaba `posicion`.
  return agregarPosicionesReales(rows)
}

//Crear resultado y pruebas en transacción
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

//Actualizar resultado y reemplazar pruebas
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

//Eliminar resultado (cascada elimina pruebas_resultado por FK)
export const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM resultados WHERE id = $1 RETURNING id`,
    [id]
  )
  return rows[0] || null
}

//Estadísticas generales
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

//Estadísticas por club
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

const resolverConvocatoria = async (client, convocatoriaId) => {
  const { rows } = await client.query(
    `SELECT evento_id, disciplina_id, categoria_id, genero_id FROM convocatorias WHERE id = $1`,
    [convocatoriaId]
  )
  return rows[0] || null
}

//Resultados de una convocatoria específica, ya con el lugar de cada quien
//calculado (1°, 2°, 3°... con empates compartiendo lugar).
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

// Borra los resultados de una convocatoria (y sus pruebas hijas primero,
// porque `pruebas_resultado` no tiene ON DELETE CASCADE hacia `resultados`
// — si se borra el resultado antes que sus pruebas, Postgres rechaza el
// DELETE con una violación de foreign key).
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

// Borra los resultados previos de la convocatoria antes de insertar, así
// que volver a subir el Excel actualiza en vez de duplicar.
export const createMasivoPorConvocatoria = async (convocatoriaId, atletasResultados, anoCompetitivo) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const conv = await resolverConvocatoria(client, convocatoriaId)
    if (!conv) { await client.query('ROLLBACK'); return null }

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

    // Avisar a los atletas de esa convocatoria (notificación en la app +
    // correo) de que ya hay resultados. Se hace DESPUÉS del commit, y con
    // su propio try/catch — si el correo falla, los resultados ya quedaron
    // guardados de todas formas.
    try {
      const { rows: datos } = await pool.query(
        `SELECT e.titulo AS evento_titulo, d.nombre AS disciplina, cat.nombre AS categoria
         FROM eventos e
         JOIN disciplinas d  ON d.id = $1
         JOIN categorias cat ON cat.id = $2
         WHERE e.id = $3`,
        [conv.disciplina_id, conv.categoria_id, conv.evento_id]
      )
      const info = datos[0]
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