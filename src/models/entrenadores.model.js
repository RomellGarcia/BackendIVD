import { pool } from '../config/db.js'
import { supabase } from '../config/supabase.js'
import { actualizarDatosUsuario, actualizarClubEntidad } from './usuario.model.js'
import * as NotificacionModel from './notificacion.model.js'
import {
  sendEntrenadorSalioClubEmail,
  sendSalidaClubEmail,
  sendSolicitudAceptadaEmail,
  sendSolicitudRechazadaEmail,
  sendInvitacionEntrenadorAceptadaClubEmail,
  sendInvitacionEntrenadorRechazadaClubEmail
} from '../services/email.service.js'

// Lista todos los entrenadores con filtros (club_id, sin_club)
export const findAll = async ({ clubId, sinClub } = {}) => {
  let whereClause = 'WHERE 1=1'
  const parametros = []

  if (clubId) {
    parametros.push(clubId)
    whereClause += ` AND e.club_id = $${parametros.length}`
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
     LEFT JOIN entrenador_certificaciones tc ON tc.entrenador_id = e.id
     LEFT JOIN certificaciones_catalogo ce   ON ce.id = tc.certificacion_id
     LEFT JOIN entrenador_especialidades te  ON te.entrenador_id = e.id
     LEFT JOIN especialidades_catalogo es    ON es.id = te.especialidad_id
     ${whereClause}
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.curp, u.fecha_nacimiento, u.estado_nacimiento,
              g.nombre, c.id, c.nombre
     ORDER BY u.apellido_paterno ASC`,
    parametros
  )
  return rows
}

// Entrenadores asignados a un club específico
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
     LEFT JOIN entrenador_certificaciones tc ON tc.entrenador_id = e.id
     LEFT JOIN certificaciones_catalogo ce   ON ce.id = tc.certificacion_id
     LEFT JOIN entrenador_especialidades te  ON te.entrenador_id = e.id
     LEFT JOIN especialidades_catalogo es    ON es.id = te.especialidad_id
     WHERE e.club_id = $1 AND e.estado = 'activo'
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono
     ORDER BY u.apellido_paterno ASC`,
    [clubId]
  )
  return rows
}

// Detalle de un entrenador por su ID
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
     LEFT JOIN entrenador_certificaciones tc ON tc.entrenador_id = e.id
     LEFT JOIN certificaciones_catalogo ce   ON ce.id = tc.certificacion_id
     LEFT JOIN entrenador_especialidades te  ON te.entrenador_id = e.id
     LEFT JOIN especialidades_catalogo es    ON es.id = te.especialidad_id
     WHERE e.id = $1
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.fecha_nacimiento, u.curp,
              u.estado_nacimiento, g.nombre, c.id, c.nombre`,
    [entrenadorId]
  )
  return rows[0] || null
}

// Solicitudes de entrenadores para un club (filtro opcional por tipo)
export const findSolicitudesByClub = async (clubId, tipo) => {
  const parametros = [clubId]
  let whereClause = 'WHERE se.club_id = $1'
  if (tipo) {
    parametros.push(tipo)
    whereClause += ` AND se.tipo = $${parametros.length}`
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
     ${whereClause}
     ORDER BY se.fecha_solicitud DESC`,
    parametros
  )
  return rows
}

// Crea una invitación desde el club hacia un entrenador independiente
export const crearInvitacionClub = async ({ entrenadorId, clubId }) => {
  const { rows: entrenadorRows } = await pool.query(
    `SELECT club_id FROM entrenadores WHERE id = $1`,
    [entrenadorId]
  )
  const entrenador = entrenadorRows[0]
  if (!entrenador) return { error: 'Entrenador no encontrado' }
  if (entrenador.club_id) return { error: 'El entrenador ya pertenece a un club' }

  const { rows: pendientes } = await pool.query(
    `SELECT * FROM solicitudes_entrenadores
     WHERE entrenador_id = $1 AND club_id = $2 AND estado = 'pendiente'`,
    [entrenadorId, clubId]
  )
  if (pendientes.length > 0) {
    const pendiente = pendientes[0]
    // El entrenador ya había solicitado unirse a este club - acepta esta
    if (pendiente.tipo !== 'invitacion') {
      return await updateSolicitud(pendiente.id, 'aceptada', { clubId })
    }
    return { error: 'Ya existe una invitación o solicitud pendiente con este entrenador' }
  }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, tipo, estado)
     VALUES ($1, $2, 'invitacion', 'pendiente')
     RETURNING *`,
    [entrenadorId, clubId]
  )
  return { solicitud: rows[0] }
}

// Actualiza el estado de una solicitud o invitación (aceptada/rechazada)
export const updateSolicitud = async (solicitudId, estado, actor = {}) => {
  const { rows: solicitudes } = await pool.query(
    `SELECT se.*, u.nombre AS entrenador_nombre, u.email AS entrenador_email,
            c.nombre AS club_nombre, c.email AS club_email
     FROM solicitudes_entrenadores se
     JOIN entrenadores e ON se.entrenador_id = e.id
     JOIN usuarios u     ON e.usuario_id = u.id
     JOIN clubes c       ON se.club_id = c.id
     WHERE se.id = $1`,
    [solicitudId]
  )
  const solicitud = solicitudes[0]
  if (!solicitud) return null

  // Validar que el actor tenga permiso sobre esta solicitud
  if (actor.clubId && solicitud.club_id !== actor.clubId) {
    return { error: 'Esta solicitud no pertenece a tu club.' }
  }
  if (actor.entrenadorId && solicitud.entrenador_id !== actor.entrenadorId) {
    return { error: 'Esta solicitud no te pertenece.' }
  }

  // Actualizar estado
  const { rows } = await pool.query(
    `UPDATE solicitudes_entrenadores
     SET estado = $1
     WHERE id = $2
     RETURNING *`,
    [estado, solicitudId]
  )

  // Si es aceptada, asignar el entrenador al club
  if (estado === 'aceptada') {
    await pool.query(
      `UPDATE entrenadores
       SET club_id = $1
       WHERE id = $2`,
      [solicitud.club_id, solicitud.entrenador_id]
    )
  }

  // Notificaciones y correos
  try {
    if (actor.clubId) {
      // El club responde a una solicitud del entrenador
      const mensaje = estado === 'aceptada'
        ? `Tu solicitud para unirte a "${solicitud.club_nombre}" fue aceptada.`
        : `Tu solicitud para unirte a "${solicitud.club_nombre}" fue rechazada.`
      const { rows: usuarioRows } = await pool.query(
        `SELECT usuario_id FROM entrenadores WHERE id = $1`, [solicitud.entrenador_id]
      )
      if (usuarioRows[0]) await NotificacionModel.crear(usuarioRows[0].usuario_id, mensaje)

      if (estado === 'aceptada') {
        await sendSolicitudAceptadaEmail({ to: solicitud.entrenador_email, nombre: solicitud.entrenador_nombre, clubNombre: solicitud.club_nombre })
      } else {
        await sendSolicitudRechazadaEmail({ to: solicitud.entrenador_email, nombre: solicitud.entrenador_nombre, clubNombre: solicitud.club_nombre })
      }
    } else if (actor.entrenadorId) {
      // El entrenador responde a una invitación del club
      const mensaje = estado === 'aceptada'
        ? `El entrenador "${solicitud.entrenador_nombre}" aceptó tu invitación.`
        : `El entrenador "${solicitud.entrenador_nombre}" rechazó tu invitación.`
      await NotificacionModel.crearParaClub(solicitud.club_id, mensaje)

      if (estado === 'aceptada') {
        await sendInvitacionEntrenadorAceptadaClubEmail({ to: solicitud.club_email, clubNombre: solicitud.club_nombre, entrenadorNombre: solicitud.entrenador_nombre })
      } else {
        await sendInvitacionEntrenadorRechazadaClubEmail({ to: solicitud.club_email, clubNombre: solicitud.club_nombre, entrenadorNombre: solicitud.entrenador_nombre })
      }
    }
  } catch (err) {
    console.error('No se pudo notificar la respuesta de la solicitud:', err)
  }

  return rows[0]
}

// Actualización de entrenador por parte del administrador
export const updateAdmin = async (entrenadorId, campos) => {
  const { rows: entrenadorRows } = await pool.query(
    `SELECT usuario_id FROM entrenadores WHERE id = $1`,
    [entrenadorId]
  )
  const usuarioId = entrenadorRows[0]?.usuario_id
  if (!usuarioId) return null

  const { anos_experiencia, ...datosUsuario } = campos

  await actualizarDatosUsuario(usuarioId, datosUsuario)

  if (anos_experiencia !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET anos_experiencia = $1 WHERE id = $2`,
      [anos_experiencia, entrenadorId]
    )
  }

  return findById(entrenadorId)
}

// Asigna o quita un club a un entrenador (admin o club propietario)
export const updateClub = async (entrenadorId, clubId, actorClubId = null) => {
  if (actorClubId) {
    if (clubId) {
      return { error: 'Un club no puede asignarse un entrenador directamente — usa el flujo de solicitud/invitación.' }
    }
    const { rows: actual } = await pool.query(`SELECT club_id FROM entrenadores WHERE id = $1`, [entrenadorId])
    if (!actual[0]) return null
    if (actual[0].club_id !== actorClubId) {
      return { error: 'Este entrenador no pertenece a tu club.' }
    }
  }

  // Guardar información del club anterior si se va a desasignar
  let clubQueSaleInfo = null
  if (!clubId) {
    const { rows } = await pool.query(
      `SELECT c.id AS club_id, c.email AS club_email, c.nombre AS club_nombre, u.nombre AS entrenador_nombre, u.email AS entrenador_email
       FROM entrenadores e
       JOIN usuarios u     ON e.usuario_id = u.id
       LEFT JOIN clubes c  ON e.club_id = c.id
       WHERE e.id = $1`,
      [entrenadorId]
    )
    clubQueSaleInfo = rows[0]?.club_id ? rows[0] : null
  }

  const resultado = await actualizarClubEntidad('entrenadores', entrenadorId, clubId)

  // Si el entrenador era entrenador principal del club, limpiar esa referencia
  if (clubQueSaleInfo) {
    await pool.query(
      `UPDATE clubes SET entrenador_id = NULL WHERE id = $1 AND entrenador_id = $2`,
      [clubQueSaleInfo.club_id, entrenadorId]
    )
  }

  // Notificar salida del club
  if (clubQueSaleInfo) {
    try {
      await NotificacionModel.crearParaClub(clubQueSaleInfo.club_id, `El entrenador "${clubQueSaleInfo.entrenador_nombre}" salió de tu club.`)
      const { rows: entrenadorRows } = await pool.query(`SELECT usuario_id FROM entrenadores WHERE id = $1`, [entrenadorId])
      const usuarioId = entrenadorRows[0]?.usuario_id
      if (usuarioId) {
        await NotificacionModel.crear(usuarioId, `Ya no perteneces al club "${clubQueSaleInfo.club_nombre}".`)
      }
      await sendEntrenadorSalioClubEmail({
        to: clubQueSaleInfo.club_email,
        clubNombre: clubQueSaleInfo.club_nombre,
        entrenadorNombre: clubQueSaleInfo.entrenador_nombre,
      })
      if (clubQueSaleInfo.entrenador_email) {
        await sendSalidaClubEmail({
          to: clubQueSaleInfo.entrenador_email,
          nombre: clubQueSaleInfo.entrenador_nombre,
          clubNombre: clubQueSaleInfo.club_nombre,
        })
      }
    } catch (err) {
      console.error('No se pudo notificar la salida del club:', err)
    }
  }

  return resultado
}

// Elimina un entrenador (solo admin) - bloqueado si tiene resultados asociados
export const remove = async (entrenadorId) => {
  // Verificar si tiene resultados registrados
  const { rows: resultados } = await pool.query(
    `SELECT id FROM resultados WHERE entrenador_id = $1 LIMIT 1`,
    [entrenadorId]
  )
  if (resultados.length > 0) {
    return { error: 'No se puede eliminar: el entrenador tiene resultados registrados' }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: entrenadorRows } = await client.query(
      `SELECT e.usuario_id, u.supabase_uid FROM entrenadores e
       JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.id = $1`,
      [entrenadorId]
    )
    if (!entrenadorRows[0]) {
      await client.query('ROLLBACK')
      return { error: 'Entrenador no encontrado' }
    }
    const usuarioId = entrenadorRows[0].usuario_id
    const supabaseUid = entrenadorRows[0].supabase_uid

    // Quitar referencia si es entrenador principal de algún club
    await client.query(`UPDATE clubes SET entrenador_id = NULL WHERE entrenador_id = $1`, [entrenadorId])

    // Eliminar relaciones propias (el catálogo no se toca)
    await client.query(`DELETE FROM entrenador_certificaciones WHERE entrenador_id = $1`, [entrenadorId])
    await client.query(`DELETE FROM entrenador_especialidades WHERE entrenador_id = $1`, [entrenadorId])
    await client.query(`DELETE FROM atleta_entrenador WHERE entrenador_id = $1`, [entrenadorId])
    await client.query(`DELETE FROM solicitudes_entrenadores WHERE entrenador_id = $1`, [entrenadorId])

    await client.query(`DELETE FROM entrenadores WHERE id = $1`, [entrenadorId])
    await client.query(`DELETE FROM usuarios WHERE id = $1`, [usuarioId])

    await client.query('COMMIT')

    // Borra también la cuenta de Supabase Auth para liberar el correo
    if (supabaseUid) {
      try {
        await supabase.auth.admin.deleteUser(supabaseUid)
      } catch (errAuth) {
        console.error('No se pudo borrar la cuenta de Supabase Auth del entrenador:', errAuth.message)
      }
    }

    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}