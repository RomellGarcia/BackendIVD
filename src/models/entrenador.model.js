import { pool } from '../config/db.js'

//Perfil completo del entrenador (el que está logueado)
export const findByUsuarioId = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre,
      COALESCE(
        JSON_AGG(DISTINCT jsonb_build_object('id', ce.id, 'nombre', ce.nombre))
        FILTER (WHERE ce.id IS NOT NULL), '[]'
      ) AS certificaciones,
      COALESCE(
        JSON_AGG(DISTINCT jsonb_build_object('id', es.id, 'nombre', es.nombre))
        FILTER (WHERE es.id IS NOT NULL), '[]'
      ) AS especialidades
     FROM entrenadores e
     JOIN usuarios u ON e.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     LEFT JOIN clubes c ON e.club_id = c.id
     LEFT JOIN certificaciones ce ON ce.entrenador_id = e.id
     LEFT JOIN especialidades es ON es.entrenador_id = e.id
     WHERE e.usuario_id = $1
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.fecha_nacimiento, u.curp,
              g.nombre, c.id, c.nombre`,
    [usuarioId]
  )
  return rows[0] || null
}

//Obtener atletas del mismo club que el entrenador
export const findAtletasByEntrenador = async (entrenadorId) => {
  const { rows } = await pool.query(
    `SELECT
      a.id AS atleta_id,
      u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento,
      g.nombre AS genero,
      a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club
     FROM entrenadores e
     JOIN atletas a ON a.club_id = e.club_id
     JOIN usuarios u ON a.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     WHERE e.id = $1 AND e.club_id IS NOT NULL
     ORDER BY u.apellido_paterno ASC`,
    [entrenadorId]
  )
  return rows
}

//Stats del entrenador para su dashboard
export const getStats = async (entrenadorId) => {
  const { rows } = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM atletas a
       JOIN entrenadores e ON a.club_id = e.club_id
       WHERE e.id = $1) AS total_atletas,
      (SELECT COUNT(*) FROM eventos
       WHERE fecha >= CURRENT_DATE AND estado = true) AS eventos_proximos
     FROM entrenadores e
     WHERE e.id = $1`,
    [entrenadorId]
  )
  return rows[0] || { total_atletas: 0, eventos_proximos: 0 }
}

//Actividad reciente: próximos 5 eventos
export const getActividad = async () => {
  const { rows } = await pool.query(
    `SELECT id, titulo, lugar, fecha, descripcion
     FROM eventos
     WHERE fecha >= CURRENT_DATE AND estado = true
     ORDER BY fecha ASC
     LIMIT 5`
  )
  return rows.map(e => ({
    tipo: 'evento',
    titulo: e.titulo,
    descripcion: `${e.titulo} — ${e.lugar}`,
    fecha: e.fecha
  }))
}

//Solicitar unirse a un club
export const crearSolicitudClub = async ({ entrenadorId, clubId, mensaje }) => {
  // Verificar si ya hay solicitud pendiente o aceptada
  const { rows: existente } = await pool.query(
    `SELECT id FROM solicitudes_entrenadores
     WHERE entrenador_id = $1 AND club_id = $2
     AND estado IN ('pendiente', 'aceptada')`,
    [entrenadorId, clubId]
  )
  if (existente.length > 0) return { error: 'Ya tienes una solicitud activa para este club' }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, mensaje, estado)
     VALUES ($1, $2, $3, 'pendiente')
     RETURNING *`,
    [entrenadorId, clubId, mensaje || null]
  )
  return { solicitud: rows[0] }
}

//Solicitudes enviadas por el entrenador
export const findSolicitudesByEntrenador = async (entrenadorId) => {
  const { rows } = await pool.query(
    `SELECT
      se.id, se.mensaje, se.estado, se.fecha_solicitud,
      c.id AS club_id, c.nombre AS club_nombre,
      c.email AS club_email, c.telefono AS club_telefono
     FROM solicitudes_entrenadores se
     JOIN clubes c ON se.club_id = c.id
     WHERE se.entrenador_id = $1
     ORDER BY se.fecha_solicitud DESC`,
    [entrenadorId]
  )
  return rows
}

//Actualizar perfil (datos en usuarios + datos en entrenadores)
export const updatePerfil = async (entrenadorId, usuarioId, { telefono, anos_experiencia }) => {
  if (telefono !== undefined) {
    await pool.query(
      `UPDATE usuarios SET telefono = $1 WHERE id = $2`,
      [telefono, usuarioId]
    )
  }
  if (anos_experiencia !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET anos_experiencia = $1 WHERE id = $2`,
      [anos_experiencia, entrenadorId]
    )
  }
}

//Reemplazar certificaciones del entrenador
export const updateCertificaciones = async (entrenadorId, certificaciones = []) => {
  await pool.query(`DELETE FROM certificaciones WHERE entrenador_id = $1`, [entrenadorId])
  for (const nombre of certificaciones) {
    await pool.query(
      `INSERT INTO certificaciones (entrenador_id, nombre) VALUES ($1, $2)`,
      [entrenadorId, nombre]
    )
  }
}

//Reemplazar especialidades del entrenador
export const updateEspecialidades = async (entrenadorId, especialidades = []) => {
  await pool.query(`DELETE FROM especialidades WHERE entrenador_id = $1`, [entrenadorId])
  for (const nombre of especialidades) {
    await pool.query(
      `INSERT INTO especialidades (entrenador_id, nombre) VALUES ($1, $2)`,
      [entrenadorId, nombre]
    )
  }
}