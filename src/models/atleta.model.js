import { pool } from '../config/db.js'
import { actualizarDatosUsuario, actualizarClubEntidad } from './usuario.model.js'

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

//Actualizar datos del perfil del atleta
export const updatePerfil = async (atletaId, usuarioId, { telefono, municipio, lugar_entrenamiento }) => {
  if (telefono !== undefined) {
    await pool.query(
      `UPDATE usuarios SET telefono = $1 WHERE id = $2`,
      [telefono, usuarioId]
    )
  }
  if (municipio !== undefined || lugar_entrenamiento !== undefined) {
    await pool.query(
      `UPDATE atletas
       SET municipio           = COALESCE($1, municipio),
           lugar_entrenamiento = COALESCE($2, lugar_entrenamiento)
       WHERE id = $3`,
      [municipio ?? null, lugar_entrenamiento ?? null, atletaId]
    )
  }
}

//Actualizar datos generales del atleta (usado por admin: nombre, apellidos,
//email, telefono, curp, fecha de nacimiento, estado de nacimiento, genero,
//municipio y lugar de entrenamiento). El cambio de club sigue viviendo en
//updateClub, no se duplica aqui.
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

//Asignar / quitar club a un atleta (usado por admin)
export const updateClub = async (atletaId, clubId) => {
  return actualizarClubEntidad('atletas', atletaId, clubId)
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
  return { solicitud: rows[0] }
}

export const findSolicitudesClub = async ({ clubId, atletaId } = {}) => {
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

  const { rows } = await pool.query(
    `SELECT
      sc.id, sc.tipo, sc.estado, sc.mensaje, sc.fecha_solicitud,
      u.nombre, u.apellido_paterno, u.apellido_materno, u.email,
      a.id AS atleta_id,
      c.id AS club_id, c.nombre AS club_nombre
     FROM solicitudes_club sc
     JOIN usuarios u     ON sc.usuario_id = u.id
     JOIN atletas a      ON a.usuario_id = u.id
     LEFT JOIN clubes c  ON sc.club_id = c.id
     ${where}
     ORDER BY sc.fecha_solicitud DESC`,
    params
  )
  return rows
}

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

  if (estado === 'aceptada') {
    //Obtener atleta_id desde usuario_id
    const { rows: atletaRows } = await pool.query(
      `SELECT id FROM atletas WHERE usuario_id = $1`,
      [solicitud.usuario_id]
    )
    const atletaId = atletaRows[0]?.id

    if (solicitud.tipo === 'asociar' && solicitud.club_id) {
      await pool.query(
        `UPDATE atletas
         SET club_id = $1, fecha_ingreso_club = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [solicitud.club_id, atletaId]
      )
    }

    if (solicitud.tipo === 'independiente') {
      await pool.query(
        `UPDATE atletas SET club_id = NULL, fecha_ingreso_club = NULL WHERE id = $1`,
        [atletaId]
      )
    }
  }

  return { ok: true }
}