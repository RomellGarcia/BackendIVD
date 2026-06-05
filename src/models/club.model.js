import { pool } from '../config/db.js'

//Obtener todos los clubes activos
export const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT 
      id, nombre, direccion, telefono, email,
      descripcion, estado, fecha_creacion, fecha_actualizacion
     FROM clubes
     WHERE estado = 'activo'
     ORDER BY nombre ASC`
  )
  return rows
}

//Obtener un club por ID con sus entrenadores y atletas
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT 
      c.id, c.nombre, c.direccion, c.telefono, c.email,
      c.descripcion, c.estado, c.fecha_creacion, c.fecha_actualizacion,
      COUNT(DISTINCT a.id) AS total_atletas,
      COUNT(DISTINCT e.id) AS total_entrenadores
     FROM clubes c
     LEFT JOIN atletas a ON a.club_id = c.id
     LEFT JOIN entrenadores e ON e.club_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  )
  return rows[0] || null
}

//Crear club
export const create = async ({ nombre, direccion, telefono, email, descripcion }) => {
  const { rows } = await pool.query(
    `INSERT INTO clubes (nombre, direccion, telefono, email, descripcion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [nombre, direccion || null, telefono || null, email || null, descripcion || null]
  )
  return rows[0]
}

//Actualizar club
export const update = async (id, { nombre, direccion, telefono, email, descripcion, estado }) => {
  const { rows } = await pool.query(
    `UPDATE clubes
     SET 
       nombre = COALESCE($1, nombre),
       direccion = COALESCE($2, direccion),
       telefono = COALESCE($3, telefono),
       email = COALESCE($4, email),
       descripcion = COALESCE($5, descripcion),
       estado = COALESCE($6, estado),
       fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [nombre, direccion, telefono, email, descripcion, estado, id]
  )
  return rows[0] || null
}

//Eliminar club (soft delete)
export const softDelete = async (id) => {
  const { rows } = await pool.query(
    `UPDATE clubes
     SET estado = 'inactivo', fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id`,
    [id]
  )
  return rows[0] || null
}

//Obtener atletas de un club
export const findAtletasByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono, u.fecha_nacimiento,
      g.nombre AS genero,
      a.municipio, a.lugar_entrenamiento, a.fecha_ingreso_club
     FROM atletas a
     JOIN usuarios u ON a.usuario_id = u.id
     LEFT JOIN generos g ON u.genero_id = g.id
     WHERE a.club_id = $1
     ORDER BY u.apellido_paterno ASC`,
    [clubId]
  )
  return rows
}

//Obtener entrenadores de un club
export const findEntrenadoresByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      e.anos_experiencia, e.estado
     FROM entrenadores e
     JOIN usuarios u ON e.usuario_id = u.id
     WHERE e.club_id = $1 AND e.estado = 'activo'
     ORDER BY u.apellido_paterno ASC`,
    [clubId]
  )
  return rows
}