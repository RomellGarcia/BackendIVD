import { pool } from '../config/db.js'

//Entrenadores asignados a un club
export const findByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
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
     LEFT JOIN certificaciones ce ON ce.entrenador_id = e.id
     LEFT JOIN especialidades es ON es.entrenador_id = e.id
     WHERE e.club_id = $1 AND e.estado = 'activo'
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono
     ORDER BY u.apellido_paterno ASC`,
    [clubId]
  )
  return rows
}

//Solicitudes de entrenadores para un club
export const findSolicitudesByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT
      se.id, se.mensaje, se.estado, se.fecha_solicitud,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      e.id AS entrenador_id, e.anos_experiencia
     FROM solicitudes_entrenadores se
     JOIN entrenadores e ON se.entrenador_id = e.id
     JOIN usuarios u ON e.usuario_id = u.id
     WHERE se.club_id = $1
     ORDER BY se.fecha_solicitud DESC`,
    [clubId]
  )
  return rows
}

//Actualizar estado de solicitud
//Si se acepta se le asigna el entrenador al club
export const updateSolicitud = async (solicitudId, estado) => {
  //Obtener la solicitud primero
  const { rows: solicitudes } = await pool.query(
    `SELECT * FROM solicitudes_entrenadores WHERE id = $1`,
    [solicitudId]
  )
  const solicitud = solicitudes[0]
  if (!solicitud) return null

  //Actualizar estado
  const { rows } = await pool.query(
    `UPDATE solicitudes_entrenadores
     SET estado = $1
     WHERE id = $2
     RETURNING *`,
    [estado, solicitudId]
  )

  //Si se acepta, asignar el entrenador al club
  if (estado === 'aceptada') {
    await pool.query(
      `UPDATE entrenadores
       SET club_id = $1
       WHERE id = $2`,
      [solicitud.club_id, solicitud.entrenador_id]
    )
  }

  return rows[0]
}