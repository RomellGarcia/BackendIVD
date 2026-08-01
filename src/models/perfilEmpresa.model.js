import { pool } from '../config/db.js'

// Obtiene perfil de la empresa con sus redes sociales
export const find = async () => {
  const { rows: perfil } = await pool.query(
    `SELECT
      p.id, p.nombre_empresa, p.eslogan, p.logo,
      p.direccion, p.correo, p.telefono,
      p.mostrar_whatsapp, p.fecha_creacion, p.fecha_actualizacion,
      COALESCE(
        JSON_AGG(
          jsonb_build_object('plataforma', r.plataforma, 'url', r.url)
        ) FILTER (WHERE r.id IS NOT NULL), '[]'
      ) AS redes_sociales
     FROM perfil_empresa p
     LEFT JOIN redes_sociales r ON r.empresa_id = p.id
     GROUP BY p.id
     LIMIT 1`
  )
  return perfil[0] || null
}

// Actualiza datos del perfil y sus redes sociales (transacción)
export const update = async ({ nombre_empresa, eslogan, direccion, correo, telefono, mostrar_whatsapp, redes }) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Obtener id del perfil existente
    const { rows: perfilExistente } = await client.query(`SELECT id FROM perfil_empresa LIMIT 1`)
    if (!perfilExistente[0]) throw new Error('No existe perfil registrado')
    const empresaId = perfilExistente[0].id

    // Actualizar datos del perfil
    const { rows } = await client.query(
      `UPDATE perfil_empresa
       SET nombre_empresa    = COALESCE($1, nombre_empresa),
           eslogan           = COALESCE($2, eslogan),
           direccion         = $3,
           correo            = $4,
           telefono          = $5,
           mostrar_whatsapp  = $6,
           fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [nombre_empresa ?? null, eslogan ?? null, direccion, correo, telefono, mostrar_whatsapp, empresaId]
    )

    // Reemplazar redes sociales (borrar y reinsertar)
    if (redes && Array.isArray(redes)) {
      await client.query(`DELETE FROM redes_sociales WHERE empresa_id = $1`, [empresaId])
      for (const red of redes) {
        if (red.url) {
          await client.query(
            `INSERT INTO redes_sociales (empresa_id, plataforma, url) VALUES ($1, $2, $3)`,
            [empresaId, red.plataforma, red.url]
          )
        }
      }
    }

    await client.query('COMMIT')
    return rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
