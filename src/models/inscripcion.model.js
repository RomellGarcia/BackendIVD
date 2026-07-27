import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'

// Obtiene convocatorias disponibles para un atleta según su edad y género
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
      e.imagen_url,
      e.documento_convocatoria_url AS "documentoConvocatoria",
      e.documento_deslinde_url    AS "documentoDeslinde",
      c.id        AS convocatoria_id,
      d.nombre    AS disciplina,
      cat.nombre  AS categoria,
      cat.edad_min, cat.edad_max,
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
     ORDER BY e.fecha ASC`,
    [atletaId]
  )
  return rows
}

// Lista inscripciones de un club (para ver qué atletas tiene inscritos)
export const findByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado, i.bib,
      c.id AS convocatoria_id, c.estado AS convocatoria_estado,
      e.id AS evento_id, e.titulo, e.fecha, e.hora, e.lugar, e.descripcion, e.fecha_cierre,
      e.finalizado AS evento_finalizado,
      e.imagen_url,
      e.documento_convocatoria_url AS "documentoConvocatoria",
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

// Inscribe a un atleta en una convocatoria, asignándole un número de corredor (bib) único
export const inscribir = async ({ atletaId, convocatoriaId }) => {
  // Verificar que la convocatoria existe y el evento sigue abierto
  const { rows: convocatoriaInfo } = await pool.query(
    `SELECT c.id, e.fecha_cierre, e.titulo
     FROM convocatorias c
     JOIN eventos e ON c.evento_id = e.id
     WHERE c.id = $1 AND c.estado = true AND e.estado = true`,
    [convocatoriaId]
  )
  if (!convocatoriaInfo[0]) return { error: 'Convocatoria no encontrada o cerrada' }
  if (new Date() > new Date(convocatoriaInfo[0].fecha_cierre)) {
    return { error: 'La convocatoria ya está cerrada' }
  }

  // Verificar que no esté ya inscrito
  const { rows: yaInscrito } = await pool.query(
    `SELECT id FROM inscripciones
     WHERE atleta_id = $1 AND convocatoria_id = $2`,
    [atletaId, convocatoriaId]
  )
  if (yaInscrito.length > 0) return { error: 'Ya estás inscrito en esta convocatoria' }

  // Asignar un bib aleatorio único en el rango 1-999
  let bib = null
  for (let intento = 0; intento < 30; intento++) {
    const candidato = Math.floor(Math.random() * 999) + 1
    const { rows: existe } = await pool.query(
      `SELECT id FROM inscripciones WHERE convocatoria_id = $1 AND bib = $2`,
      [convocatoriaId, candidato]
    )
    if (existe.length === 0) { bib = candidato; break }
  }
  if (bib === null) {
    return { error: 'No hay números de corredor disponibles para esta convocatoria (límite de 999 alcanzado)' }
  }

  const { rows } = await pool.query(
    `INSERT INTO inscripciones (atleta_id, convocatoria_id, validado, bib)
     VALUES ($1, $2, true, $3)
     RETURNING *`,
    [atletaId, convocatoriaId, bib]
  )
  return { inscripcion: rows[0] }
}

// Lista todas las inscripciones de un atleta
export const findByAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado, i.bib,
      c.id AS convocatoria_id,
      e.id AS evento_id, e.titulo, e.fecha, e.lugar,
      e.documento_convocatoria_url AS "documentoConvocatoria",
      e.documento_deslinde_url    AS "documentoDeslinde",
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

// Obtiene participantes de un evento (todas las inscripciones de sus convocatorias)
export const findByEvento = async (eventoId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado, i.bib,
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

// Verifica si un atleta pertenece a un club determinado
export const atletaPerteneceAClub = async (atletaId, clubId) => {
  const { rows } = await pool.query(
    `SELECT id FROM atletas WHERE id = $1 AND club_id = $2`,
    [atletaId, clubId]
  )
  return rows.length > 0
}

// Lista todas las convocatorias abiertas (eventos activos y no cerrados)
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

// El atleta cancela su propia inscripción (solo si el evento no ha pasado)
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

// Administrador da de baja a un atleta de una convocatoria (sin restricciones de fecha)
export const removerPorAdmin = async (inscripcionId) => {
  const { rows } = await pool.query(
    `SELECT i.id, a.usuario_id, e.titulo AS evento_titulo, d.nombre AS disciplina, cat.nombre AS categoria
     FROM inscripciones i
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN eventos e       ON c.evento_id = e.id
     JOIN disciplinas d   ON c.disciplina_id = d.id
     JOIN categorias cat  ON c.categoria_id = cat.id
     JOIN atletas a       ON i.atleta_id = a.id
     WHERE i.id = $1`,
    [inscripcionId]
  )
  const inscripcion = rows[0]
  if (!inscripcion) return { error: 'Inscripción no encontrada' }

  await pool.query(`DELETE FROM inscripciones WHERE id = $1`, [inscripcionId])

  const mensaje = `Fuiste dado de baja de "${inscripcion.disciplina} - ${inscripcion.categoria}" del evento "${inscripcion.evento_titulo}" por un administrador.`
  await NotificacionModel.crear(inscripcion.usuario_id, mensaje)

  return { ok: true }
}

// Lista participantes de una convocatoria específica (ordenados por número de corredor)
export const findByConvocatoria = async (convocatoriaId) => {
  const { rows } = await pool.query(
    `SELECT
      i.id, i.fecha_inscripcion, i.validado, i.bib,
      a.id AS atleta_id,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      d.nombre AS disciplina,
      cat.nombre AS categoria,
      c.id AS convocatoria_id,
      cl.id AS club_id,
      cl.nombre AS club_nombre
     FROM inscripciones i
     JOIN atletas a       ON i.atleta_id = a.id
     JOIN usuarios u      ON a.usuario_id = u.id
     JOIN generos g       ON u.genero_id = g.id
     JOIN convocatorias c ON i.convocatoria_id = c.id
     JOIN disciplinas d   ON c.disciplina_id = d.id
     JOIN categorias cat  ON c.categoria_id = cat.id
     LEFT JOIN clubes cl  ON a.club_id = cl.id
     WHERE c.id = $1
     ORDER BY i.bib ASC`,
    [convocatoriaId]
  )
  return rows
}