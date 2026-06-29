import { pool } from '../config/db.js'

//Todos los eventos activos
export const findAll = async (limit) => {
  const query = `
    SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.imagen_url, e.created_at,
      COALESCE(
        JSON_AGG(
          jsonb_build_object(
            'id', c.id,
            'disciplina', d.nombre,
            'categoria', cat.nombre,
            'genero', g.nombre,
            'estado', c.estado
          )
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS convocatorias
    FROM eventos e
    LEFT JOIN convocatorias c ON c.evento_id = e.id
    LEFT JOIN disciplinas d   ON c.disciplina_id = d.id
    LEFT JOIN categorias cat  ON c.categoria_id = cat.id
    LEFT JOIN generos g       ON c.genero_id = g.id
    WHERE e.estado = true
    GROUP BY e.id
    ORDER BY e.created_at DESC
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `
  const { rows } = await pool.query(query)
  return rows
}

//Un evento por ID con sus convocatorias
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.imagen_url, e.created_at,
      COALESCE(
        JSON_AGG(
          jsonb_build_object(
            'id', c.id,
            'disciplina_id', c.disciplina_id,
            'disciplina', d.nombre,
            'categoria_id', c.categoria_id,
            'categoria', cat.nombre,
            'genero_id', c.genero_id,
            'genero', g.nombre,
            'estado', c.estado
          )
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS convocatorias
     FROM eventos e
     LEFT JOIN convocatorias c ON c.evento_id = e.id
     LEFT JOIN disciplinas d   ON c.disciplina_id = d.id
     LEFT JOIN categorias cat  ON c.categoria_id = cat.id
     LEFT JOIN generos g       ON c.genero_id = g.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [id]
  )
  return rows[0] || null
}

//Crear evento y sus convocatorias en una transacción
export const create = async ({ titulo, fecha, hora, lugar, descripcion, fecha_cierre, imagen_url, convocatorias }) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: eventoRows } = await client.query(
      `INSERT INTO eventos (titulo, fecha, hora, lugar, descripcion, fecha_cierre, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [titulo, fecha, hora, lugar, descripcion || null, fecha_cierre, imagen_url || null]
    )
    const evento = eventoRows[0]

    for (const conv of convocatorias) {
      await client.query(
        `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id)
         VALUES ($1, $2, $3, $4)`,
        [evento.id, conv.disciplina_id, conv.categoria_id, conv.genero_id]
      )
    }

    await client.query('COMMIT')
    return await findById(evento.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

//Agregar convocatoria a evento existente
export const addConvocatoria = async (eventoId, { disciplina_id, categoria_id, genero_id }) => {
  const { rows } = await pool.query(
    `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventoId, disciplina_id, categoria_id, genero_id]
  )
  return rows[0]
}

//Actualizar fecha de cierre
export const updateFechaCierre = async (id, fecha_cierre) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET fecha_cierre = $1 WHERE id = $2 RETURNING *`,
    [fecha_cierre, id]
  )
  return rows[0] || null
}

//Convocatorias disponibles para un atleta (filtra por edad y género)
export const findConvocatoriasParaAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id AS evento_id, e.titulo, e.fecha, e.hora,
      e.lugar, e.descripcion, e.fecha_cierre, e.imagen_url,
      c.id AS convocatoria_id,
      d.nombre AS disciplina,
      cat.nombre AS categoria, cat.edad_min, cat.edad_max,
      g.nombre AS genero
     FROM convocatorias c
     JOIN eventos e    ON c.evento_id = e.id
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     JOIN atletas a      ON a.id = $1
     JOIN usuarios u     ON a.usuario_id = u.id
     WHERE e.estado = true
       AND e.fecha_cierre > NOW()
       AND c.estado = true
       AND (
         -- Edad del atleta calculada desde fecha_nacimiento
         DATE_PART('year', AGE(u.fecha_nacimiento)) BETWEEN cat.edad_min AND cat.edad_max
       )
       AND (
         g.nombre = u_genero.nombre OR g.nombre = 'mixto'
       )
     -- JOIN adicional para obtener el género del usuario
     JOIN generos u_genero ON u.genero_id = u_genero.id
     ORDER BY e.fecha ASC`,
    [atletaId]
  )
  return rows
}