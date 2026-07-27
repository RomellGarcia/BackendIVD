import { pool } from '../config/db.js'

// Busca un usuario por su UID de Supabase
export const findBySupabaseUid = async (supabaseUid) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id,
      u.nombre,
      u.apellido_paterno,
      u.apellido_materno,
      u.email,
      u.supabase_uid,
      u.telefono,
      u.curp,
      u.fecha_nacimiento,
      u.estado_nacimiento,
      r.nombre AS rol,
      g.nombre AS genero
     FROM usuarios u
     JOIN roles r ON u.rol_id = r.id
     LEFT JOIN generos g ON u.genero_id = g.id
     WHERE u.supabase_uid = $1`,
    [supabaseUid]
  )
  return rows[0] || null
}

// Actualiza los campos base de la tabla usuarios (nombre, apellidos, email, etc.)
export const actualizarDatosUsuario = async (usuarioId, {
  nombre, apellido_paterno, apellido_materno, email,
  telefono, curp, fecha_nacimiento, estado_nacimiento, genero
} = {}) => {
  let idGenero = null
  if (genero !== undefined) {
    const { rows } = await pool.query(`SELECT id FROM generos WHERE nombre = $1`, [genero])
    idGenero = rows[0]?.id ?? null
  }

  await pool.query(
    `UPDATE usuarios SET
       nombre            = COALESCE($1, nombre),
       apellido_paterno  = COALESCE($2, apellido_paterno),
       apellido_materno  = COALESCE($3, apellido_materno),
       email             = COALESCE($4, email),
       telefono          = COALESCE($5, telefono),
       curp              = COALESCE($6, curp),
       fecha_nacimiento  = COALESCE($7, fecha_nacimiento),
       estado_nacimiento = COALESCE($8, estado_nacimiento),
       genero_id         = COALESCE($9, genero_id)
     WHERE id = $10`,
    [
      nombre ?? null, apellido_paterno ?? null, apellido_materno ?? null, email ?? null,
      telefono ?? null, curp ?? null, fecha_nacimiento ?? null, estado_nacimiento ?? null,
      idGenero, usuarioId
    ]
  )
}

// Mapeo de tablas que tienen columna club_id
const TABLAS_CON_CLUB = {
  atletas:      { tabla: 'atletas',      setFechaIngreso: true },
  entrenadores: { tabla: 'entrenadores', setFechaIngreso: false }
}

// Asigna o quita el club a una entidad 
export const actualizarClubEntidad = async (tipo, entidadId, clubId) => {
  const config = TABLAS_CON_CLUB[tipo]
  if (!config) throw new Error(`Tipo de entidad no soportado: ${tipo}`)

  const query = config.setFechaIngreso
    ? `UPDATE ${config.tabla}
       SET club_id = $1::integer,
           fecha_ingreso_club = CASE WHEN $1::integer IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2
       RETURNING *`
    : `UPDATE ${config.tabla}
       SET club_id = $1::integer
       WHERE id = $2
       RETURNING *`

  const { rows } = await pool.query(query, [clubId ?? null, entidadId])
  return rows[0] || null
}