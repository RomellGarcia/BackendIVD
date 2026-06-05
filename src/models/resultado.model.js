import { pool } from '../config/db.js'

//Query base reutilizable para traer resultados con JOINs
const RESULTADO_BASE = `
  SELECT
    r.id, r.ano_competitivo, r.fecha_registro,
    e.id AS evento_id, e.titulo AS evento_titulo, e.fecha AS evento_fecha,
    u.nombre, u.apellido_paterno, u.apellido_materno,
    a.id AS atleta_id, a.municipio, a.lugar_entrenamiento,
    c_atleta.nombre AS club_nombre,
    ue.nombre AS entrenador_nombre,
    ue.apellido_paterno AS entrenador_apellido,
    en.id AS entrenador_id,
    cat.nombre AS categoria,
    g.nombre AS genero,
    d.nombre AS disciplina,
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
  LEFT JOIN pruebas_resultado pr ON pr.resultado_id = r.id
`

const RESULTADO_GROUP = `
  GROUP BY
    r.id, e.id, e.titulo, e.fecha,
    u.nombre, u.apellido_paterno, u.apellido_materno,
    a.id, a.municipio, a.lugar_entrenamiento,
    c_atleta.nombre, ue.nombre, ue.apellido_paterno,
    en.id, cat.nombre, g.nombre, d.nombre
`

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
  return rows
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

//Resultados por atleta
export const findByAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE r.atleta_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [atletaId]
  )
  return rows
}

//Resultados por club
export const findByClub = async (clubId) => {
  const { rows } = await pool.query(
    `${RESULTADO_BASE}
     WHERE a.club_id = $1
     ${RESULTADO_GROUP}
     ORDER BY r.fecha_registro DESC`,
    [clubId]
  )
  return rows
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
  return rows
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