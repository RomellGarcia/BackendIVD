import { pool } from '../config/db.js'
import { supabase } from '../config/supabase.js'
import { actualizarDatosUsuario, actualizarClubEntidad } from './usuario.model.js'
import {
  sendSolicitudAceptadaEmail,
  sendSolicitudRechazadaEmail,
  sendInvitacionClubEmail,
  sendSalidaClubEmail,
  sendSolicitudRecibidaClubEmail,
  sendInvitacionAceptadaClubEmail,
  sendInvitacionRechazadaClubEmail,
  sendAtletaSalioClubEmail
} from '../services/email.service.js'
import * as NotificacionModel from './notificacion.model.js'

// Perfil completo del atleta logueado
export const findByUsuarioId = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT
      a.id, a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp,
      u.estado_nacimiento,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre,
      c.lugar_entrenamiento AS club_lugar_entrenamiento,
      r.nombre AS rol
     FROM atletas a
     JOIN usuarios u  ON a.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     LEFT JOIN clubes c  ON a.club_id = c.id
     JOIN roles r        ON u.rol_id = r.id
     WHERE a.usuario_id = $1`,
    [usuarioId]
  )
  return rows[0] || null
}

// Listado de atletas con filtros opcionales
export const findAll = async ({ clubId, sinClub } = {}) => {
  let whereClause = 'WHERE 1=1'
  const params = []

  if (clubId) {
    params.push(clubId)
    whereClause += ` AND a.club_id = $${params.length}`
  } else if (sinClub) {
    whereClause += ` AND a.club_id IS NULL`
  }

  const { rows } = await pool.query(
    `SELECT
      a.id, a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp, u.estado_nacimiento,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre
     FROM atletas a
     JOIN usuarios u      ON a.usuario_id = u.id
     LEFT JOIN generos g  ON u.genero_id = g.id
     LEFT JOIN clubes c   ON a.club_id = c.id
     ${whereClause}
     ORDER BY u.apellido_paterno ASC`,
    params
  )
  return rows
}

// Obtiene un atleta por su ID interno
export const findById = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      a.id, a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp,
      u.estado_nacimiento,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre
     FROM atletas a
     JOIN usuarios u      ON a.usuario_id = u.id
     LEFT JOIN generos g  ON u.genero_id = g.id
     LEFT JOIN clubes c   ON a.club_id = c.id
     WHERE a.id = $1`,
    [atletaId]
  )
  return rows[0] || null
}

// Actualiza el perfil del atleta autenticado (ignora lugar_entrenamiento si el club ya tiene uno)
export const updatePerfil = async (atletaId, usuarioId, fields) => {
  const { municipio, lugar_entrenamiento, ...datosUsuarioActualizados } = fields

  await actualizarDatosUsuario(usuarioId, datosUsuarioActualizados)

  if (municipio !== undefined || lugar_entrenamiento !== undefined) {
    let lugarAAplicar = lugar_entrenamiento

    if (lugar_entrenamiento !== undefined) {
      const { rows } = await pool.query(
        `SELECT c.lugar_entrenamiento AS club_lugar
         FROM atletas a
         LEFT JOIN clubes c ON a.club_id = c.id
         WHERE a.id = $1`,
        [atletaId]
      )
      const lugarDelClub = rows[0]?.club_lugar
      // Si el club ya tiene lugar de entrenamiento, pasa al atleta
      if (lugarDelClub) lugarAAplicar = undefined
    }

    await pool.query(
      `UPDATE atletas
       SET municipio           = COALESCE($1, municipio),
           lugar_entrenamiento = COALESCE($2, lugar_entrenamiento)
       WHERE id = $3`,
      [municipio ?? null, lugarAAplicar ?? null, atletaId]
    )
  }
}

// Actualiza un atleta (solo administrador)
export const updateAdmin = async (atletaId, fields) => {
  const { rows: atletaRows } = await pool.query(
    `SELECT usuario_id FROM atletas WHERE id = $1`,
    [atletaId]
  )
  const usuarioId = atletaRows[0]?.usuario_id
  if (!usuarioId) return null

  const { municipio, lugar_entrenamiento, ...datosUsuarioActualizados } = fields

  await actualizarDatosUsuario(usuarioId, datosUsuarioActualizados)

  if (municipio !== undefined || lugar_entrenamiento !== undefined) {
    await pool.query(
      `UPDATE atletas
       SET municipio           = COALESCE($1, municipio),
           lugar_entrenamiento = COALESCE($2, lugar_entrenamiento)
       WHERE id = $3`,
      [municipio ?? null, lugar_entrenamiento ?? null, atletaId]
    )
  }

  return findById(atletaId)
}

// Asigna o quita club a un atleta (admin o club propietario). Si el club tiene lugar, se copia.
export const updateClub = async (atletaId, clubId, actorClubId = null) => {
  // Si quien llama es un club (no admin), solo puede expulsar a sus propios atletas
  if (actorClubId) {
    if (clubId) {
      return { error: 'Un club no puede asignarse un atleta directamente — usa el flujo de solicitud/invitación.' }
    }
    const { rows: actual } = await pool.query(`SELECT club_id FROM atletas WHERE id = $1`, [atletaId])
    if (!actual[0]) return null
    if (actual[0].club_id !== actorClubId) {
      return { error: 'Este atleta no pertenece a tu club.' }
    }
  }

  // Guardar información del club anterior si se va a desasignar
  let clubQueSaleInfo = null
  if (!clubId) {
    const { rows } = await pool.query(
      `SELECT c.id AS club_id, c.email AS club_email, c.nombre AS club_nombre, u.nombre AS atleta_nombre, u.email AS atleta_email
       FROM atletas a
       JOIN usuarios u     ON a.usuario_id = u.id
       LEFT JOIN clubes c  ON a.club_id = c.id
       WHERE a.id = $1`,
      [atletaId]
    )
    clubQueSaleInfo = rows[0]?.club_id ? rows[0] : null
  }

  const resultado = await actualizarClubEntidad('atletas', atletaId, clubId)

  // Copiar lugar_entrenamiento del club si se asigna, o limpiarlo si se quita
  if (clubId) {
    const { rows } = await pool.query(`SELECT lugar_entrenamiento FROM clubes WHERE id = $1`, [clubId])
    const lugarClub = rows[0]?.lugar_entrenamiento
    if (lugarClub) {
      await pool.query(`UPDATE atletas SET lugar_entrenamiento = $1 WHERE id = $2`, [lugarClub, atletaId])
    }
  } else {
    await pool.query(`UPDATE atletas SET lugar_entrenamiento = NULL WHERE id = $1`, [atletaId])
  }

  // Notificar salida del club (correo + notificación)
  if (clubQueSaleInfo) {
    try {
      await NotificacionModel.crearParaClub(clubQueSaleInfo.club_id, `El atleta "${clubQueSaleInfo.atleta_nombre}" salió de tu club.`)
      const { rows: atletaRows } = await pool.query(`SELECT usuario_id FROM atletas WHERE id = $1`, [atletaId])
      const usuarioId = atletaRows[0]?.usuario_id
      if (usuarioId) {
        await NotificacionModel.crear(usuarioId, `Ya no perteneces al club "${clubQueSaleInfo.club_nombre}".`)
      }
      await sendAtletaSalioClubEmail({
        to: clubQueSaleInfo.club_email,
        clubNombre: clubQueSaleInfo.club_nombre,
        atletaNombre: clubQueSaleInfo.atleta_nombre,
      })
      if (clubQueSaleInfo.atleta_email) {
        await sendSalidaClubEmail({
          to: clubQueSaleInfo.atleta_email,
          nombre: clubQueSaleInfo.atleta_nombre,
          clubNombre: clubQueSaleInfo.club_nombre,
        })
      }
    } catch (err) {
      console.error('No se pudo notificar la salida del club:', err)
    }
  }

  return resultado
}

// Elimina un atleta (verifica que no tenga resultados ni inscripciones)
export const remove = async (atletaId) => {
  // Verificar resultados
  const { rows: resultados } = await pool.query(
    `SELECT id FROM resultados WHERE atleta_id = $1 LIMIT 1`,
    [atletaId]
  )
  if (resultados.length > 0) {
    return { error: 'No se puede eliminar: el atleta tiene resultados registrados' }
  }

  // Verificar inscripciones
  const { rows: inscripciones } = await pool.query(
    `SELECT id FROM inscripciones WHERE atleta_id = $1 LIMIT 1`,
    [atletaId]
  )
  if (inscripciones.length > 0) {
    return { error: 'No se puede eliminar: el atleta tiene inscripciones a eventos' }
  }

  // Eliminar atleta y usuario en cascada
  const { rows } = await pool.query(
    `DELETE FROM atletas WHERE id = $1 RETURNING usuario_id`,
    [atletaId]
  )
  if (!rows[0]) return { error: 'Atleta no encontrado' }

  const { rows: usuarioEliminado } = await pool.query(
    `DELETE FROM usuarios WHERE id = $1 RETURNING supabase_uid`,
    [rows[0].usuario_id]
  )

  // Borra también la cuenta de Supabase Auth para liberar el correo
  const supabaseUid = usuarioEliminado[0]?.supabase_uid
  if (supabaseUid) {
    try {
      await supabase.auth.admin.deleteUser(supabaseUid)
    } catch (errAuth) {
      console.error('No se pudo borrar la cuenta de Supabase Auth del atleta:', errAuth.message)
    }
  }

  return { ok: true }
}

//SOLICITUDES DE CLUB

// Crea una solicitud de asociación a un club
export const crearSolicitudClub = async ({ atletaId, clubId, tipo }) => {
  // Verificar si ya tiene solicitud pendiente
  const { rows: pendientes } = await pool.query(
    `SELECT * FROM solicitudes_club
     WHERE usuario_id = (SELECT usuario_id FROM atletas WHERE id = $1)
     AND estado = 'pendiente'`,
    [atletaId]
  )
  if (pendientes.length > 0) {
    const pendiente = pendientes[0]
    // El club ya lo había invitado a este mismo club - aceptar esa
    if (tipo === 'asociar' && pendiente.tipo === 'invitacion' && pendiente.club_id === clubId) {
      return await procesarSolicitudClub(pendiente.id, 'aceptada')
    }
    return { error: 'Ya tienes una solicitud pendiente' }
  }

  // Si quiere asociarse, verificar que no tenga club activo
  if (tipo === 'asociar') {
    const { rows: actual } = await pool.query(
      `SELECT club_id FROM atletas WHERE id = $1`,
      [atletaId]
    )
    if (actual[0]?.club_id) return { error: 'Debes dejar tu club actual antes de solicitar otro' }
  }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_club (usuario_id, club_id, tipo, estado)
     VALUES (
       (SELECT usuario_id FROM atletas WHERE id = $1),
       $2, $3, 'pendiente'
     )
     RETURNING *`,
    [atletaId, clubId ?? null, tipo]
  )

  // Notificar al club cuando el atleta solicita asociarse
  if (tipo === 'asociar' && clubId) {
    try {
      const { rows: datos } = await pool.query(
        `SELECT u.nombre AS atleta_nombre, c.email AS club_email, c.nombre AS club_nombre
         FROM atletas a
         JOIN usuarios u ON a.usuario_id = u.id, clubes c
         WHERE a.id = $1 AND c.id = $2`,
        [atletaId, clubId]
      )
      const info = datos[0]
      if (info) {
        const mensaje = `El atleta "${info.atleta_nombre}" solicitó unirse a tu club.`
        await NotificacionModel.crearParaClub(clubId, mensaje)
        await sendSolicitudRecibidaClubEmail({ to: info.club_email, clubNombre: info.club_nombre, atletaNombre: info.atleta_nombre })
      }
    } catch (err) {
      console.error('No se pudo notificar al club la nueva solicitud:', err)
    }
  }

  return { solicitud: rows[0] }
}

// Crea una invitación del club hacia un atleta 
export const crearInvitacionClub = async ({ atletaId, clubId }) => {
  const { rows: atletaRows } = await pool.query(
    `SELECT usuario_id, club_id FROM atletas WHERE id = $1`,
    [atletaId]
  )
  const atleta = atletaRows[0]
  if (!atleta) return { error: 'Atleta no encontrado' }
  if (atleta.club_id) return { error: 'El atleta ya pertenece a un club' }

  const { rows: pendientes } = await pool.query(
    `SELECT * FROM solicitudes_club
     WHERE usuario_id = $1 AND club_id = $2 AND estado = 'pendiente'`,
    [atleta.usuario_id, clubId]
  )
  if (pendientes.length > 0) {
    const pendiente = pendientes[0]
    // El atleta ya había solicitado unirse a este club - aceptar
    if (pendiente.tipo === 'asociar') {
      return await procesarSolicitudClub(pendiente.id, 'aceptada')
    }
    return { error: 'Ya existe una invitación o solicitud pendiente con este atleta' }
  }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_club (usuario_id, club_id, tipo, estado)
     VALUES ($1, $2, 'invitacion', 'pendiente')
     RETURNING *`,
    [atleta.usuario_id, clubId]
  )

  // Notificar al atleta (notificación + correo)
  try {
    const { rows: datos } = await pool.query(
      `SELECT u.nombre, u.email, c.nombre AS club_nombre
       FROM usuarios u, clubes c
       WHERE u.id = $1 AND c.id = $2`,
      [atleta.usuario_id, clubId]
    )
    const info = datos[0]
    if (info) {
      const mensaje = `El club "${info.club_nombre}" te envió una invitación para unirte.`
      await NotificacionModel.crear(atleta.usuario_id, mensaje)
      await sendInvitacionClubEmail({ to: info.email, nombre: info.nombre, clubNombre: info.club_nombre })
    }
  } catch (err) {
    console.error('No se pudo notificar la invitación de club:', err)
  }

  return { solicitud: rows[0] }
}

// Lista solicitudes de club con filtros opcionales 
export const findSolicitudesClub = async ({ clubId, atletaId, tipo } = {}) => {
  let where = 'WHERE 1=1'
  const params = []

  if (clubId) {
    params.push(clubId)
    where += ` AND sc.club_id = $${params.length}`
  }
  if (atletaId) {
    params.push(atletaId)
    where += ` AND a.id = $${params.length}`
  }
  if (tipo) {
    params.push(tipo)
    where += ` AND sc.tipo = $${params.length}`
  }

  const { rows } = await pool.query(
    `SELECT
      sc.id, sc.tipo, sc.estado, sc.mensaje, sc.fecha_solicitud,
      u.nombre, u.apellido_paterno, u.apellido_materno, u.email, u.telefono,
      DATE_PART('year', AGE(u.fecha_nacimiento))::int AS edad,
      g.nombre AS genero,
      a.id AS atleta_id,
      c.id AS club_id, c.nombre AS club_nombre
     FROM solicitudes_club sc
     JOIN usuarios u     ON sc.usuario_id = u.id
     JOIN atletas a      ON a.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     LEFT JOIN clubes c  ON sc.club_id = c.id
     ${where}
     ORDER BY sc.fecha_solicitud DESC`,
    params
  )
  return rows
}

// Procesa una solicitud (aceptar/rechazar). Maneja notificaciones y actualización de club
export const procesarSolicitudClub = async (solicitudId, estado) => {
  const { rows: solicitudRows } = await pool.query(
    `SELECT * FROM solicitudes_club WHERE id = $1`,
    [solicitudId]
  )
  const solicitud = solicitudRows[0]
  if (!solicitud) return { error: 'Solicitud no encontrada' }
  if (solicitud.estado !== 'pendiente') return { error: 'La solicitud ya fue procesada' }

  // Actualizar estado
  await pool.query(
    `UPDATE solicitudes_club SET estado = $1 WHERE id = $2`,
    [estado, solicitudId]
  )

  let clubQueSaleInfo = null
  let invitacionAceptadaInfo = null
  let invitacionRechazadaInfo = null

  if (estado === 'aceptada') {
    // Obtener atleta_id desde usuario_id
    const { rows: atletaRows } = await pool.query(
      `SELECT id FROM atletas WHERE usuario_id = $1`,
      [solicitud.usuario_id]
    )
    const atletaId = atletaRows[0]?.id

    // Asociar o independizar según tipo
    if ((solicitud.tipo === 'asociar' || solicitud.tipo === 'invitacion') && solicitud.club_id) {
      await pool.query(
        `UPDATE atletas
         SET club_id = $1, fecha_ingreso_club = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [solicitud.club_id, atletaId]
      )

      const { rows: clubRows } = await pool.query(
        `SELECT lugar_entrenamiento FROM clubes WHERE id = $1`,
        [solicitud.club_id]
      )
      const lugarClub = clubRows[0]?.lugar_entrenamiento
      if (lugarClub) {
        await pool.query(
          `UPDATE atletas SET lugar_entrenamiento = $1 WHERE id = $2`,
          [lugarClub, atletaId]
        )
      }

      // Si fue una invitación, notificar al club que fue aceptada
      if (solicitud.tipo === 'invitacion') {
        const { rows: datosInv } = await pool.query(
          `SELECT u.nombre AS atleta_nombre, c.email AS club_email, c.nombre AS club_nombre
           FROM usuarios u, clubes c
           WHERE u.id = $1 AND c.id = $2`,
          [solicitud.usuario_id, solicitud.club_id]
        )
        invitacionAceptadaInfo = datosInv[0] || null
      }
    }

    if (solicitud.tipo === 'independiente') {
      const { rows: clubActual } = await pool.query(
        `SELECT c.id AS club_id, c.email AS club_email, c.nombre AS club_nombre, u.nombre AS atleta_nombre
         FROM atletas a
         JOIN usuarios u     ON a.usuario_id = u.id
         LEFT JOIN clubes c  ON a.club_id = c.id
         WHERE a.id = $1`,
        [atletaId]
      )
      clubQueSaleInfo = clubActual[0]?.club_id ? clubActual[0] : null

      await pool.query(
        `UPDATE atletas SET club_id = NULL, fecha_ingreso_club = NULL, lugar_entrenamiento = NULL WHERE id = $1`,
        [atletaId]
      )
    }
  }

  // Si fue una invitación y el atleta la rechazó, avisar al club igual que cuando la acepta 
  if (estado === 'rechazada' && solicitud.tipo === 'invitacion' && solicitud.club_id) {
    const { rows: datosInv } = await pool.query(
      `SELECT u.nombre AS atleta_nombre, c.email AS club_email, c.nombre AS club_nombre
       FROM usuarios u, clubes c
       WHERE u.id = $1 AND c.id = $2`,
      [solicitud.usuario_id, solicitud.club_id]
    )
    invitacionRechazadaInfo = datosInv[0] || null
  }

  // Notificar al atleta el resultado (si hay club involucrado)
  if ((estado === 'aceptada' || estado === 'rechazada') && solicitud.club_id) {
    try {
      const { rows: datos } = await pool.query(
        `SELECT u.nombre, u.email, c.nombre AS club_nombre
         FROM usuarios u, clubes c
         WHERE u.id = $1 AND c.id = $2`,
        [solicitud.usuario_id, solicitud.club_id]
      )
      const info = datos[0]
      if (info) {
        const mensaje = estado === 'aceptada'
          ? `Tu solicitud para unirte a "${info.club_nombre}" fue aceptada.`
          : `Tu solicitud para unirte a "${info.club_nombre}" fue rechazada.`
        await NotificacionModel.crear(solicitud.usuario_id, mensaje)

        if (estado === 'aceptada') {
          await sendSolicitudAceptadaEmail({ to: info.email, nombre: info.nombre, clubNombre: info.club_nombre })
        } else {
          await sendSolicitudRechazadaEmail({ to: info.email, nombre: info.nombre, clubNombre: info.club_nombre })
        }
      }
    } catch (err) {
      console.error('No se pudo notificar el resultado de la solicitud:', err)
    }
  }

  // Notificar al club que su invitación fue aceptada
  if (invitacionAceptadaInfo) {
    try {
      await NotificacionModel.crearParaClub(solicitud.club_id, `El atleta "${invitacionAceptadaInfo.atleta_nombre}" aceptó tu invitación.`)
      await sendInvitacionAceptadaClubEmail({
        to: invitacionAceptadaInfo.club_email,
        clubNombre: invitacionAceptadaInfo.club_nombre,
        atletaNombre: invitacionAceptadaInfo.atleta_nombre,
      })
    } catch (err) {
      console.error('No se pudo notificar al club la invitación aceptada:', err)
    }
  }

  // Notificar al club que su invitación fue rechazada
  if (invitacionRechazadaInfo) {
    try {
      await NotificacionModel.crearParaClub(solicitud.club_id, `El atleta "${invitacionRechazadaInfo.atleta_nombre}" rechazó tu invitación.`)
      await sendInvitacionRechazadaClubEmail({
        to: invitacionRechazadaInfo.club_email,
        clubNombre: invitacionRechazadaInfo.club_nombre,
        atletaNombre: invitacionRechazadaInfo.atleta_nombre,
      })
    } catch (err) {
      console.error('No se pudo notificar al club la invitación rechazada:', err)
    }
  }

  // Notificar salida del club cuando un atleta se independiza
  if (clubQueSaleInfo) {
    try {
      const { rows: usuarioRows } = await pool.query(`SELECT email FROM usuarios WHERE id = $1`, [solicitud.usuario_id])
      const atletaEmail = usuarioRows[0]?.email

      await NotificacionModel.crearParaClub(clubQueSaleInfo.club_id, `El atleta "${clubQueSaleInfo.atleta_nombre}" salió de tu club.`)
      await NotificacionModel.crear(solicitud.usuario_id, `Ya no perteneces al club "${clubQueSaleInfo.club_nombre}".`)
      await sendAtletaSalioClubEmail({
        to: clubQueSaleInfo.club_email,
        clubNombre: clubQueSaleInfo.club_nombre,
        atletaNombre: clubQueSaleInfo.atleta_nombre,
      })
      if (atletaEmail) {
        await sendSalidaClubEmail({
          to: atletaEmail,
          nombre: clubQueSaleInfo.atleta_nombre,
          clubNombre: clubQueSaleInfo.club_nombre,
        })
      }
    } catch (err) {
      console.error('No se pudo notificar la salida del club:', err)
    }
  }

  return { ok: true }
}