import { pool } from '../config/db.js'
import { actualizarDatosUsuario } from './usuario.model.js'
import * as NotificacionModel from './notificacion.model.js'
import { sendEntrenadorSalioClubEmail, sendSalidaClubEmail, sendSolicitudEntrenadorRecibidaClubEmail } from '../services/email.service.js'
import { updateSolicitud } from './entrenadores.model.js'

//Perfil completo del entrenador (el que está logueado)
export const findByUsuarioId = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado, e.lugar_entrenamiento AS lugar_entrenamiento_propio, e.municipio,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp, u.estado_nacimiento,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre, c.lugar_entrenamiento AS club_lugar_entrenamiento,
      COALESCE(
        JSON_AGG(DISTINCT jsonb_build_object('id', cc.id, 'nombre', cc.nombre))
        FILTER (WHERE cc.id IS NOT NULL), '[]'
      ) AS certificaciones,
      COALESCE(
        JSON_AGG(DISTINCT jsonb_build_object('id', ec.id, 'nombre', ec.nombre))
        FILTER (WHERE ec.id IS NOT NULL), '[]'
      ) AS especialidades
     FROM entrenadores e
     JOIN usuarios u ON e.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     LEFT JOIN clubes c ON e.club_id = c.id
     LEFT JOIN entrenador_certificaciones tc ON tc.entrenador_id = e.id
     LEFT JOIN certificaciones_catalogo cc   ON cc.id = tc.certificacion_id
     LEFT JOIN entrenador_especialidades te  ON te.entrenador_id = e.id
     LEFT JOIN especialidades_catalogo ec    ON ec.id = te.especialidad_id
     WHERE e.usuario_id = $1
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno,
              u.email, u.telefono, u.fecha_nacimiento, u.curp, u.estado_nacimiento,
              g.nombre, c.id, c.nombre`,
    [usuarioId]
  )
  const entrenador = rows[0]
  if (!entrenador) return null

  // El del club manda si el club tiene uno definido; si no, se usa el propio del entrenador.
  const usaClub = !!entrenador.club_lugar_entrenamiento
  entrenador.lugar_entrenamiento = usaClub ? entrenador.club_lugar_entrenamiento : entrenador.lugar_entrenamiento_propio
  entrenador.lugar_entrenamiento_editable = !usaClub
  delete entrenador.lugar_entrenamiento_propio
  delete entrenador.club_lugar_entrenamiento

  return entrenador
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
    `SELECT id, titulo, lugar, hora, fecha
     FROM eventos
     WHERE fecha >= CURRENT_DATE AND estado = true
     ORDER BY fecha ASC
     LIMIT 5`
  )
  return rows
}

//Solicitar unirse a un club
export const crearSolicitudClub = async ({ entrenadorId, clubId, mensaje }) => {
  // Verificar si ya hay solicitud pendiente o aceptada
  const { rows: existente } = await pool.query(
    `SELECT * FROM solicitudes_entrenadores
     WHERE entrenador_id = $1 AND club_id = $2
     AND estado IN ('pendiente', 'aceptada')`,
    [entrenadorId, clubId]
  )
  if (existente.length > 0) {
    const pendiente = existente[0]
    // El club ya lo había invitado a este mismo club - aceptar
    if (pendiente.estado === 'pendiente' && pendiente.tipo === 'invitacion') {
      return await updateSolicitud(pendiente.id, 'aceptada', { entrenadorId })
    }
    return { error: 'Ya tienes una solicitud activa para este club' }
  }

  const { rows } = await pool.query(
    `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, mensaje, estado)
     VALUES ($1, $2, $3, 'pendiente')
     RETURNING *`,
    [entrenadorId, clubId, mensaje || null]
  )

  // Notifica al club
  try {
    const { rows: infoRows } = await pool.query(
      `SELECT u.nombre AS entrenador_nombre, c.email AS club_email, c.nombre AS club_nombre
       FROM entrenadores e
       JOIN usuarios u ON e.usuario_id = u.id
       JOIN clubes c ON c.id = $2
       WHERE e.id = $1`,
      [entrenadorId, clubId]
    )
    const info = infoRows[0]
    if (info) {
      await NotificacionModel.crearParaClub(clubId, `El entrenador "${info.entrenador_nombre}" solicitó unirse a tu club.`)
      if (info.club_email) {
        await sendSolicitudEntrenadorRecibidaClubEmail({ to: info.club_email, clubNombre: info.club_nombre, entrenadorNombre: info.entrenador_nombre })
      }
    }
  } catch (err) {
    console.error('No se pudo notificar la solicitud del entrenador al club:', err)
  }

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
export const updatePerfil = async (entrenadorId, usuarioId, {
  nombre, apellido_paterno, apellido_materno, telefono, genero,
  municipio, anos_experiencia, lugar_entrenamiento
}) => {
  // Datos que viven en la tabla usuarios (compartida con los demás roles)
  if (nombre !== undefined || apellido_paterno !== undefined || apellido_materno !== undefined
      || telefono !== undefined || genero !== undefined) {
    await actualizarDatosUsuario(usuarioId, { nombre, apellido_paterno, apellido_materno, telefono, genero })
  }
  if (municipio !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET municipio = $1 WHERE id = $2`,
      [municipio, entrenadorId]
    )
  }
  if (anos_experiencia !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET anos_experiencia = $1 WHERE id = $2`,
      [anos_experiencia, entrenadorId]
    )
  }
  // Se guarda como su preferencia propia aunque el club esté imponiendo
  if (lugar_entrenamiento !== undefined) {
    await pool.query(
      `UPDATE entrenadores SET lugar_entrenamiento = $1 WHERE id = $2`,
      [lugar_entrenamiento, entrenadorId]
    )
  }
}

// Busca en el catálogo sin importar mayúsculas/espacios; si no existe la crea
const buscarOCrearEnCatalogo = async (client, tabla, nombre) => {
  const limpio = nombre.trim()
  const { rows: existente } = await client.query(
    `SELECT id FROM ${tabla} WHERE LOWER(nombre) = LOWER($1)`,
    [limpio]
  )
  if (existente[0]) return existente[0].id

  const { rows: nuevo } = await client.query(
    `INSERT INTO ${tabla} (nombre) VALUES ($1) RETURNING id`,
    [limpio]
  )
  return nuevo[0].id
}

//Reemplazar certificaciones del entrenador — usa/crea del catálogo real
export const updateCertificaciones = async (entrenadorId, certificaciones = []) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM entrenador_certificaciones WHERE entrenador_id = $1`, [entrenadorId])
    for (const nombre of certificaciones) {
      if (!nombre?.trim()) continue
      const certificacionId = await buscarOCrearEnCatalogo(client, 'certificaciones_catalogo', nombre)
      await client.query(
        `INSERT INTO entrenador_certificaciones (entrenador_id, certificacion_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [entrenadorId, certificacionId]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

//Sugerencias de certificaciones para el registro/perfil ahora salen del catálogo real
export const findCertificacionesSugeridas = async () => {
  const { rows } = await pool.query(
    `SELECT nombre FROM certificaciones_catalogo ORDER BY nombre ASC`
  )
  return rows.map((r) => r.nombre)
}

//Reemplazar especialidades del entrenador — mismo criterio.
export const updateEspecialidades = async (entrenadorId, especialidades = []) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM entrenador_especialidades WHERE entrenador_id = $1`, [entrenadorId])
    for (const nombre of especialidades) {
      if (!nombre?.trim()) continue
      const especialidadId = await buscarOCrearEnCatalogo(client, 'especialidades_catalogo', nombre)
      await client.query(
        `INSERT INTO entrenador_especialidades (entrenador_id, especialidad_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [entrenadorId, especialidadId]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

//Mismo criterio que las certificaciones — del catálogo real.
export const findEspecialidadesSugeridas = async () => {
  const { rows } = await pool.query(
    `SELECT nombre FROM especialidades_catalogo ORDER BY nombre ASC`
  )
  return rows.map((r) => r.nombre)
}
// El entrenador sale de su club por su cuenta y Notifica a ambos lados igual que las demás salidas de club.
export const salirDelClub = async (entrenadorId) => {
  const { rows } = await pool.query(
    `SELECT c.id AS club_id, c.email AS club_email, c.nombre AS club_nombre,
            u.nombre AS entrenador_nombre, u.email AS entrenador_email
     FROM entrenadores e
     JOIN usuarios u     ON e.usuario_id = u.id
     LEFT JOIN clubes c  ON e.club_id = c.id
     WHERE e.id = $1`,
    [entrenadorId]
  )
  const info = rows[0]
  if (!info) return { error: 'Entrenador no encontrado' }
  if (!info.club_id) return { error: 'No perteneces a ningún club actualmente' }

  await pool.query(`UPDATE entrenadores SET club_id = NULL WHERE id = $1`, [entrenadorId])

  try {
    await NotificacionModel.crearParaClub(info.club_id, `El entrenador "${info.entrenador_nombre}" salió de tu club.`)
    const { rows: usuarioRows } = await pool.query(`SELECT usuario_id FROM entrenadores WHERE id = $1`, [entrenadorId])
    if (usuarioRows[0]) {
      await NotificacionModel.crear(usuarioRows[0].usuario_id, `Ya no perteneces al club "${info.club_nombre}".`)
    }
    await sendEntrenadorSalioClubEmail({ to: info.club_email, clubNombre: info.club_nombre, entrenadorNombre: info.entrenador_nombre })
    if (info.entrenador_email) {
      await sendSalidaClubEmail({ to: info.entrenador_email, nombre: info.entrenador_nombre, clubNombre: info.club_nombre })
    }
  } catch (err) {
    console.error('No se pudo notificar la salida del club:', err)
  }

  return { ok: true }
}