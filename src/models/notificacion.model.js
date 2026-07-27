import { pool } from '../config/db.js'

// Crea una notificación para un usuario específico
export const crear = async (usuarioId, mensaje) => {
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (usuario_id, mensaje) VALUES ($1, $2) RETURNING *`,
    [usuarioId, mensaje]
  )
  return rows[0]
}

// Crea la misma notificación para varios usuarios
export const crearParaVarios = async (usuarioIds, mensaje) => {
  if (!usuarioIds.length) return []
  const values = usuarioIds.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ')
  const params = usuarioIds.flatMap((id) => [id, mensaje])
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (usuario_id, mensaje) VALUES ${values} RETURNING *`,
    params
  )
  return rows
}

// Obtiene notificaciones no leídas de un atleta
export const findNoLeidasByAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.mensaje, n.fecha_creacion
     FROM notificaciones n
     JOIN atletas a ON a.usuario_id = n.usuario_id
     WHERE a.id = $1 AND n.leida = false
     ORDER BY n.fecha_creacion DESC`,
    [atletaId]
  )
  return rows
}

// Marca como leídas las notificaciones de un atleta
export const marcarLeidasByAtleta = async (atletaId, ids) => {
  if (!ids?.length) {
    await pool.query(
      `UPDATE notificaciones SET leida = true
       WHERE usuario_id = (SELECT usuario_id FROM atletas WHERE id = $1)`,
      [atletaId]
    )
    return
  }
  await pool.query(
    `UPDATE notificaciones SET leida = true
     WHERE usuario_id = (SELECT usuario_id FROM atletas WHERE id = $1)
       AND id = ANY($2::int[])`,
    [atletaId, ids]
  )
}

// Crea una notificación directa para un club
export const crearParaClub = async (clubId, mensaje) => {
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (club_id, mensaje) VALUES ($1, $2) RETURNING *`,
    [clubId, mensaje]
  )
  return rows[0]
}

// Obtiene notificaciones no leídas de un club
export const findNoLeidasByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT id, mensaje, fecha_creacion
     FROM notificaciones
     WHERE club_id = $1 AND leida = false
     ORDER BY fecha_creacion DESC`,
    [clubId]
  )
  return rows
}

// Marca como leídas las notificaciones de un club
export const marcarLeidasByClub = async (clubId, ids) => {
  if (!ids?.length) {
    await pool.query(`UPDATE notificaciones SET leida = true WHERE club_id = $1`, [clubId])
    return
  }
  await pool.query(
    `UPDATE notificaciones SET leida = true WHERE club_id = $1 AND id = ANY($2::int[])`,
    [clubId, ids]
  )
}