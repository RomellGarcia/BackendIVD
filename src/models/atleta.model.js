import { pool } from '../config/db.js'
import { actualizarDatosUsuario, actualizarClubEntidad } from './usuario.model.js'
import { sendSolicitudAceptadaEmail, sendSolicitudRechazadaEmail, sendInvitacionClubEmail, sendSalidaClubEmail, sendSolicitudRecibidaClubEmail, sendInvitacionAceptadaClubEmail, sendAtletaSalioClubEmail } from '../services/email.service.js'
import * as NotificacionModel from './notificacion.model.js'

//Perfil completo del atleta logueado
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

//Listado de atletas con filtros opcionales
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

//Un atleta por su id interno
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

//Perfil: el propio atleta editando sus datos. El lugar de entrenamiento es
//especial — si su club ya tiene uno puesto, el club manda: se ignora lo que
//el atleta intente mandar en ese campo y se conserva el del club.
export const updatePerfil = async (atletaId, usuarioId, fields) => {
  const { municipio, lugar_entrenamiento, ...datosUsuario } = fields

  await actualizarDatosUsuario(usuarioId, datosUsuario)

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
      // El club ya tiene uno puesto: el atleta no lo puede pisar con el suyo.
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

export const updateAdmin = async (atletaId, fields) => {
  const { rows: atletaRows } = await pool.query(
    `SELECT usuario_id FROM atletas WHERE id = $1`,
    [atletaId]
  )
  const usuarioId = atletaRows[0]?.usuario_id
  if (!usuarioId) return null

  const { municipio, lugar_entrenamiento, ...datosUsuario } = fields

  await actualizarDatosUsuario(usuarioId, datosUsuario)

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

//Asignar / quitar club a un atleta (usado por admin). Al asignar, si el
//club tiene lugar de entrenamiento, se copia al atleta; si el club no
//tiene, se deja el que ya tuviera el atleta. Al quitar el club, se le
//limpia el lugar de entrenamiento (vuelve a quedar en blanco y editable).
export const updateClub = async (atletaId, clubId) => {
  // Si el admin está SACANDO al atleta de su club (clubId llega vacío),
  // hay que guardar antes quién era ese club para poder avisarle — una
  // vez hecho el UPDATE ya no queda registro de a cuál pertenecía.
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

  if (clubId) {
    const { rows } = await pool.query(`SELECT lugar_entrenamiento FROM clubes WHERE id = $1`, [clubId])
    const lugarClub = rows[0]?.lugar_entrenamiento
    if (lugarClub) {
      await pool.query(`UPDATE atletas SET lugar_entrenamiento = $1 WHERE id = $2`, [lugarClub, atletaId])
    }
  } else {
    await pool.query(`UPDATE atletas SET lugar_entrenamiento = NULL WHERE id = $1`, [atletaId])
  }

  // Avisar (notificación + correo) al atleta y al club, si de verdad lo
  // sacaron de uno. No debe tumbar la operación si el correo falla.
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

//Eliminar atleta (verifica que no tenga resultados ni inscripciones)
export const remove = async (atletaId) => {
  //Verificar resultados
  const { rows: resultados } = await pool.query(
    `SELECT id FROM resultados WHERE atleta_id = $1 LIMIT 1`,
    [atletaId]
  )
  if (resultados.length > 0) {
    return { error: 'No se puede eliminar: el atleta tiene resultados registrados' }
  }

  //Verificar inscripciones
  const { rows: inscripciones } = await pool.query(
    `SELECT id FROM inscripciones WHERE atleta_id = $1 LIMIT 1`,
    [atletaId]
  )
  if (inscripciones.length > 0) {
    return { error: 'No se puede eliminar: el atleta tiene inscripciones a eventos' }
  }

  //Eliminar atleta y usuario en cascada
  const { rows } = await pool.query(
    `DELETE FROM atletas WHERE id = $1 RETURNING usuario_id`,
    [atletaId]
  )
  if (!rows[0]) return { error: 'Atleta no encontrado' }

  await pool.query(`DELETE FROM usuarios WHERE id = $1`, [rows[0].usuario_id])
  return { ok: true }
}

//SOLICITUDES DE CLUB

export const crearSolicitudClub = async ({ atletaId, clubId, tipo }) => {
  //Verificar solicitud pendiente existente
  const { rows: pendiente } = await pool.query(
    `SELECT id FROM solicitudes_club
     WHERE usuario_id = (SELECT usuario_id FROM atletas WHERE id = $1)
     AND estado = 'pendiente'`,
    [atletaId]
  )
  if (pendiente.length > 0) return { error: 'Ya tienes una solicitud pendiente' }

  //Si quiere asociarse, verificar que no tenga club activo
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

  // Avisar al club (notificación + correo) cuando el atleta solicita
  // asociarse — no aplica a 'independiente', que no tiene club destino.
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

//NUEVO: invitación iniciada por el club hacia un atleta independiente.
//Usa la misma tabla solicitudes_club, con tipo = 'invitacion' para
//diferenciarla de las que crea el propio atleta (tipo = 'asociar').
export const crearInvitacionClub = async ({ atletaId, clubId }) => {
  const { rows: atletaRows } = await pool.query(
    `SELECT usuario_id, club_id FROM atletas WHERE id = $1`,
    [atletaId]
  )
  const atleta = atletaRows[0]
  if (!atleta) return { error: 'Atleta no encontrado' }
  if (atleta.club_id) return { error: 'El atleta ya pertenece a un club' }

  const { rows: pendiente } = await pool.query(
    `SELECT id FROM solicitudes_club
     WHERE usuario_id = $1 AND club_id = $2 AND estado = 'pendiente'`,
    [atleta.usuario_id, clubId]
  )
  if (pendiente.length > 0) return { error: 'Ya existe una invitación o solicitud pendiente con este atleta' }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_club (usuario_id, club_id, tipo, estado)
     VALUES ($1, $2, 'invitacion', 'pendiente')
     RETURNING *`,
    [atleta.usuario_id, clubId]
  )

  // Avisar al atleta (notificación en la app + correo). Si el correo
  // falla no debe tumbar la invitación, que ya quedó guardada.
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

//AJUSTE: filtro opcional por tipo ('asociar' | 'invitacion' | 'independiente')
//para separar solicitudes recibidas de invitaciones enviadas por el club.
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

//Al aceptar: si el atleta se une a un club con lugar de entrenamiento
//puesto, se lo copia. Al independizarse, se le limpia por completo (vuelve
//a quedar editable por él mismo).
export const procesarSolicitudClub = async (solicitudId, estado) => {
  const { rows: sol } = await pool.query(
    `SELECT * FROM solicitudes_club WHERE id = $1`,
    [solicitudId]
  )
  const solicitud = sol[0]
  if (!solicitud) return { error: 'Solicitud no encontrada' }
  if (solicitud.estado !== 'pendiente') return { error: 'La solicitud ya fue procesada' }

  //Actualizar estado
  await pool.query(
    `UPDATE solicitudes_club SET estado = $1 WHERE id = $2`,
    [estado, solicitudId]
  )

  let clubQueSaleInfo = null
  let invitacionAceptadaInfo = null

  if (estado === 'aceptada') {
    //Obtener atleta_id desde usuario_id
    const { rows: atletaRows } = await pool.query(
      `SELECT id FROM atletas WHERE usuario_id = $1`,
      [solicitud.usuario_id]
    )
    const atletaId = atletaRows[0]?.id

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

      // Si el club fue quien invitó (no el atleta quien solicitó), avisarle
      // al club que su invitación fue aceptada.
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

  // Avisar al atleta del resultado (solo cuando hay un club de por medio —
  // 'asociar' o 'invitacion'; 'independiente' no aplica). Si el correo
  // falla no debe tumbar el cambio de estado, que ya quedó guardado.
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

  // El club invitó y el atleta aceptó: avisarle al club.
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

  // El atleta se independizó: avisarle al club que lo pierde, y al propio
  // atleta que ya no pertenece a él.
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