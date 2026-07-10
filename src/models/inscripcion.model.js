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
      c.id AS convocatoria_id,
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


//Para que un club pueda registrar a su atleta
export const atletaPerteneceAClub = async (atletaId, clubId) => {
  const { rows } = await pool.query(
    `SELECT id FROM atletas WHERE id = $1 AND club_id = $2`,
    [atletaId, clubId]
  )
  return rows.length > 0
}
//Todas las inscripciones de los atletas de un club (para "Mis Convocatorias" del lado del club: a qué atletas registró y en qué)
export const findByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado,
      c.id AS convocatoria_id,
      e.id AS evento_id, e.titulo, e.fecha, e.lugar, e.fecha_cierre,
      d.nombre AS disciplina,
      cat.nombre AS categoria,
      g.nombre AS genero,
      a.id AS atleta_id,
      u.nombre, u.apellido_paterno, u.apellido_materno
     FROM inscripciones i
     JOIN atletas a       ON i.atleta_id = a.id
     JOIN usuarios u      ON a.usuario_id = u.id
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN eventos e       ON c.evento_id = e.id
     JOIN disciplinas d   ON c.disciplina_id = d.id
     JOIN categorias cat  ON c.categoria_id = cat.id
     JOIN generos g       ON c.genero_id = g.id
     WHERE a.club_id = $1
     ORDER BY e.fecha DESC`,
    [clubId]
  )
  return rows
}

//Todas las convocatorias abiertas con edad y género — para que un club
//elija a cuál de sus atletas inscribir en cada una (a diferencia de
//findConvocatoriasParaAtleta, aquí no hay UN atleta cuya edad/género usar,
//así que se listan todas y el filtrado por elegibilidad se hace por atleta
//al momento de elegir a quién inscribir).
export const findConvocatoriasAbiertas = async () => {
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
     FROM convocatorias c
     JOIN eventos e      ON c.evento_id = e.id
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     WHERE e.estado = true
       AND c.estado = true
       AND e.fecha_cierre > NOW()
     ORDER BY e.fecha ASC`
  )
  return rows
}

//Cancelar inscripcion (el propio atleta se da de baja de una convocatoria).
//No se permite cancelar si el evento ya ocurrió.
export const cancelar = async (inscripcionId, atletaId) => {
  const { rows } = await pool.query(
    `SELECT i.id, e.fecha
     FROM inscripciones i
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN eventos e       ON c.evento_id = e.id
     WHERE i.id = $1 AND i.atleta_id = $2`,
    [inscripcionId, atletaId]
  )
  if (!rows[0]) return { error: 'Inscripción no encontrada' }
  if (new Date() > new Date(rows[0].fecha)) {
    return { error: 'No puedes cancelar una inscripción de un evento que ya pasó' }
  }
  await pool.query(`DELETE FROM inscripciones WHERE id = $1`, [inscripcionId])
  return { ok: true }
}