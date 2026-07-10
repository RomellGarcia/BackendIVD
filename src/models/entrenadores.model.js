import { pool } from '../config/db.js'
import { actualizarDatosUsuario, actualizarClubEntidad } from './usuario.model.js'

//Todos los entrenadores (para el panel de admin), o filtrados por club /
//sin club (usado por el panel de club para "Entrenadores Disponibles")
export const findAll = async ({ clubId, sinClub } = {}) => {
  let whereClause = 'WHERE 1=1'
  const params = []

  if (clubId) {
    params.push(clubId)
    whereClause += ` AND e.club_id = $${params.length}`
  } else if (sinClub) {
    whereClause += ` AND e.club_id IS NULL`
  }

  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.curp, u.fecha_nacimiento, u.estado_nacimiento,
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
     ${whereClause}
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.curp, u.fecha_nacimiento, u.estado_nacimiento,
              g.nombre, c.id, c.nombre
     ORDER BY u.apellido_paterno ASC`,
    params
  )
  return rows
}

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

//Un entrenador por su id interno (incluye club y datos de usuario)
export const findById = async (entrenadorId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp,
      u.estado_nacimiento,
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
     WHERE e.id = $1
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.fecha_nacimiento, u.curp,
              u.estado_nacimiento, g.nombre, c.id, c.nombre`,
    [entrenadorId]
  )
  return rows[0] || null
}

//Solicitudes de entrenadores para un club.
//AJUSTE: filtro opcional por tipo ('solicitud' | 'invitacion') para poder
//separar, del lado del club, las solicitudes recibidas de entrenadores de
//las invitaciones que el propio club envió — ambas viven en la misma tabla.
//REQUIERE: columna `tipo` en `solicitudes_entrenadores` (ver nota abajo en
//crearInvitacionClub).
export const findSolicitudesByClub = async (clubId, tipo) => {
  const params = [clubId]
  let where = 'WHERE se.club_id = $1'
  if (tipo) {
    params.push(tipo)
    where += ` AND se.tipo = $${params.length}`
  }

  const { rows } = await pool.query(
    `SELECT
      se.id, se.mensaje, se.estado, se.fecha_solicitud, se.tipo,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      e.id AS entrenador_id, e.anos_experiencia
     FROM solicitudes_entrenadores se
     JOIN entrenadores e ON se.entrenador_id = e.id
     JOIN usuarios u ON e.usuario_id = u.id
     ${where}
     ORDER BY se.fecha_solicitud DESC`,
    params
  )
  return rows
}

//NUEVO: invitación iniciada por el club hacia un entrenador independiente.
//Requiere que el entrenador la acepte (misma mecánica que updateSolicitud).
//
//IMPORTANTE — MIGRACIÓN PENDIENTE: la tabla `solicitudes_entrenadores`
//aparentemente no tiene columna `tipo` todavía (solo se usaba para
//solicitudes iniciadas por el entrenador). Antes de usar esto, correr:
//
//   ALTER TABLE solicitudes_entrenadores
//     ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'solicitud';
//
//El DEFAULT 'solicitud' hace que las filas existentes (todas creadas por
//entrenadores) sigan clasificando correctamente sin necesitar backfill.
export const crearInvitacionClub = async ({ entrenadorId, clubId }) => {
  const { rows: entrenadorRows } = await pool.query(
    `SELECT club_id FROM entrenadores WHERE id = $1`,
    [entrenadorId]
  )
  const entrenador = entrenadorRows[0]
  if (!entrenador) return { error: 'Entrenador no encontrado' }
  if (entrenador.club_id) return { error: 'El entrenador ya pertenece a un club' }

  const { rows: pendiente } = await pool.query(
    `SELECT id FROM solicitudes_entrenadores
     WHERE entrenador_id = $1 AND club_id = $2 AND estado = 'pendiente'`,
    [entrenadorId, clubId]
  )
  if (pendiente.length > 0) return { error: 'Ya existe una invitación o solicitud pendiente con este entrenador' }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, tipo, estado)
     VALUES ($1, $2, 'invitacion', 'pendiente')
     RETURNING *`,
    [entrenadorId, clubId]
  )
  return { solicitud: rows[0] }
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

//Actualizar datos generales del entrenador (usado por admin: nombre,
//apellidos, email, telefono, curp, fecha de nacimiento, estado de
//nacimiento, genero, anos de experiencia). El cambio de club vive en
//updateClub, no se duplica aqui.
export const updateAdmin = async (entrenadorId, fields) => {
  const { rows: entrenadorRows } = await pool.query(
    `SELECT usuario_id FROM entrenadores WHERE id = $1`,
    [entrenadorId]
  )
  const usuarioId = entrenadorRows[0]?.usuario_id
  if (!usuarioId) return null

  const { anos_experiencia, ...datosUsuario } = fields

  await actualizarDatosUsuario(usuarioId, datosUsuario)

  if (anos_experiencia !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET anos_experiencia = $1 WHERE id = $2`,
      [anos_experiencia, entrenadorId]
    )
  }

  return findById(entrenadorId)
}

//Asignar / quitar club a un entrenador (usado por admin)
export const updateClub = async (entrenadorId, clubId) => {
  return actualizarClubEntidad('entrenadores', entrenadorId, clubId)
}