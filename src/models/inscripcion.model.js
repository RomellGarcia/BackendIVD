import { pool } from '../config/db.js'

//Convocatorias disponibles para un atleta según su edad y género
export const findConvocatoriasParaAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id        AS evento_id,
      e.titulo,
      e.fecha,
      e.hora,
      e.lugar,
      e.descripcion,
      e.fecha_cierre,
      c.id        AS convocatoria_id,
      d.nombre    AS disciplina,
      cat.nombre  AS categoria,
      cat.edad_min,
      cat.edad_max,
      g.nombre    AS genero
     FROM atletas a
     JOIN usuarios u          ON a.usuario_id = u.id
     JOIN generos ug          ON u.genero_id = ug.id
     JOIN convocatorias c     ON true
     JOIN eventos e           ON c.evento_id = e.id
     JOIN disciplinas d       ON c.disciplina_id = d.id
     JOIN categorias cat      ON c.categoria_id = cat.id
     JOIN generos g           ON c.genero_id = g.id
     WHERE a.id = $1
       AND e.estado = true
       AND c.estado = true
       AND e.fecha_cierre > NOW()
       AND DATE_PART('year', AGE(u.fecha_nacimiento))
           BETWEEN cat.edad_min AND cat.edad_max
       AND (g.nombre = ug.nombre OR g.nombre = 'mixto')
     ORDER BY e.fecha ASC`,
    [atletaId]
  )
  return rows
}

//Inscribir atleta a convocatoria
export const inscribir = async ({ atletaId, convocatoriaId }) => {
  //Verificar que la convocatoria existe y el evento sigue abierto
  const { rows: convRows } = await pool.query(
    `SELECT c.id, e.fecha_cierre, e.titulo
     FROM convocatorias c
     JOIN eventos e ON c.evento_id = e.id
     WHERE c.id = $1 AND c.estado = true AND e.estado = true`,
    [convocatoriaId]
  )
  if (!convRows[0]) return { error: 'Convocatoria no encontrada o cerrada' }
  if (new Date() > new Date(convRows[0].fecha_cierre)) {
    return { error: 'La convocatoria ya está cerrada' }
  }

  //Verificar que no este ya inscrito en esta convocatoria
  const { rows: yaInscrito } = await pool.query(
    `SELECT id FROM inscripciones
     WHERE atleta_id = $1 AND convocatoria_id = $2`,
    [atletaId, convocatoriaId]
  )
  if (yaInscrito.length > 0) return { error: 'Ya estás inscrito en esta convocatoria' }

  const { rows } = await pool.query(
    `INSERT INTO inscripciones (atleta_id, convocatoria_id, validado)
     VALUES ($1, $2, true)
     RETURNING *`,
    [atletaId, convocatoriaId]
  )
  return { inscripcion: rows[0] }
}

//Inscripciones de un atleta
export const findByAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado,
      e.id AS evento_id, e.titulo, e.fecha, e.lugar,
      d.nombre AS disciplina,
      cat.nombre AS categoria,
      g.nombre AS genero
     FROM inscripciones i
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN eventos e       ON c.evento_id = e.id
     JOIN disciplinas d   ON c.disciplina_id = d.id
     JOIN categorias cat  ON c.categoria_id = cat.id
     JOIN generos g       ON c.genero_id = g.id
     WHERE i.atleta_id = $1
     ORDER BY e.fecha DESC`,
    [atletaId]
  )
  return rows
}

//Participantes de un evento
export const findByEvento = async (eventoId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      d.nombre AS disciplina,
      cat.nombre AS categoria,
      c.id AS convocatoria_id
     FROM inscripciones i
     JOIN atletas a       ON i.atleta_id = a.id
     JOIN usuarios u      ON a.usuario_id = u.id
     JOIN generos g       ON u.genero_id = g.id
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN disciplinas d   ON c.disciplina_id = d.id
     JOIN categorias cat  ON c.categoria_id = cat.id
     WHERE c.evento_id = $1
     ORDER BY i.fecha_inscripcion ASC`,
    [eventoId]
  )
  return rows
}