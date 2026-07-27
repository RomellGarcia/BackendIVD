import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'
import { sendEntrenadorSalioClubEmail, sendSalidaClubEmail } from '../services/email.service.js'

// Perfil completo del entrenador logueado
export const findByUsuarioId = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.anos_experiencia, e.estado,
      u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento, u.curp,
      g.nombre AS genero,
      c.id AS club_id, c.nombre AS club_nombre,
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
              u.email, u.telefono, u.fecha_nacimiento, u.curp,
              g.nombre, c.id, c.nombre`,
    [usuarioId]
  )
  return rows[0] || null
}

// Atletas del mismo club que el entrenador
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

// Estadísticas para el dashboard del entrenador
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

// Próximos 5 eventos (actividad reciente)
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

// Solicita unirse a un club
export const crearSolicitudClub = async ({ entrenadorId, clubId, mensaje }) => {
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

// Solicitudes enviadas por el entrenador
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

// Actualiza datos del perfil (telefono y años de experiencia)
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

// Busca o crea un registro en un catálogo (certificaciones o especialidades)
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

// Reemplaza las certificaciones del entrenador (usa/crea catálogo)
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

// Sugerencias para autocompletar certificaciones (desde catálogo)
export const findCertificacionesSugeridas = async () => {
  const { rows } = await pool.query(
    `SELECT nombre FROM certificaciones_catalogo ORDER BY nombre ASC`
  )
  return rows.map((r) => r.nombre)
}

// Reemplaza las especialidades del entrenador (usa/crea catálogo)
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

// Sugerencias para autocompletar especialidades (desde catálogo)
export const findEspecialidadesSugeridas = async () => {
  const { rows } = await pool.query(
    `SELECT nombre FROM especialidades_catalogo ORDER BY nombre ASC`
  )
  return rows.map((r) => r.nombre)
}

// El entrenador sale voluntariamente de su club
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