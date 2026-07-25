import { pool } from '../config/db.js'

//Query base reutilizable — trae el club con el nombre de su entrenador
//principal ya resuelto (si tiene uno asignado), para no necesitar una
//segunda consulta solo para mostrarlo.
const CLUB_BASE = `
  SELECT
    c.id, c.nombre, c.direccion, c.telefono, c.email,
    c.descripcion, c.estado, c.fecha_creacion, c.fecha_actualizacion,
    c.lugar_entrenamiento, c.entrenador_id,
    ue.nombre AS entrenador_nombre,
    ue.apellido_paterno AS entrenador_apellido_paterno,
    ue.apellido_materno AS entrenador_apellido_materno
  FROM clubes c
  LEFT JOIN entrenadores e ON c.entrenador_id = e.id
  LEFT JOIN usuarios ue    ON e.usuario_id = ue.id
`

//Obtener todos los clubes activos (con el conteo de su plantilla, para
//que la lista de búsqueda y el modal de "Ver perfil" no muestren siempre
//0 atletas · 0 entrenadores — antes solo findById calculaba esto)
export const findAll = async () => {
  const { rows } = await pool.query(
    `SELECT
      cb.*,
      COUNT(DISTINCT a.id) AS total_atletas,
      COUNT(DISTINCT e.id) AS total_entrenadores
     FROM (${CLUB_BASE} WHERE c.estado = 'activo') cb
     LEFT JOIN atletas a       ON a.club_id = cb.id
     LEFT JOIN entrenadores e  ON e.club_id = cb.id
     GROUP BY cb.id, cb.nombre, cb.direccion, cb.telefono, cb.email,
              cb.descripcion, cb.estado, cb.fecha_creacion, cb.fecha_actualizacion,
              cb.lugar_entrenamiento, cb.entrenador_id, cb.entrenador_nombre,
              cb.entrenador_apellido_paterno, cb.entrenador_apellido_materno
     ORDER BY cb.nombre ASC`
  )
  return rows
}

//Obtener un club por ID con sus entrenadores y atletas
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT
      cb.*,
      COUNT(DISTINCT a.id) AS total_atletas,
      COUNT(DISTINCT e.id) AS total_entrenadores
     FROM (${CLUB_BASE} WHERE c.id = $1) cb
     LEFT JOIN atletas a       ON a.club_id = cb.id
     LEFT JOIN entrenadores e  ON e.club_id = cb.id
     GROUP BY cb.id, cb.nombre, cb.direccion, cb.telefono, cb.email,
              cb.descripcion, cb.estado, cb.fecha_creacion, cb.fecha_actualizacion,
              cb.lugar_entrenamiento, cb.entrenador_id, cb.entrenador_nombre,
              cb.entrenador_apellido_paterno, cb.entrenador_apellido_materno`,
    [id]
  )
  return rows[0] || null
}

//Crear club
export const create = async ({ nombre, direccion, telefono, email, descripcion, lugar_entrenamiento }) => {
  const { rows } = await pool.query(
    `INSERT INTO clubes (nombre, direccion, telefono, email, descripcion, lugar_entrenamiento)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [nombre, direccion || null, telefono || null, email || null, descripcion || null, lugar_entrenamiento || null]
  )
  return rows[0]
}

//Actualizar club
export const update = async (id, { nombre, direccion, telefono, email, descripcion, estado, lugar_entrenamiento, entrenador_id }) => {
  const { rows } = await pool.query(
    `UPDATE clubes
     SET
       nombre = COALESCE($1, nombre),
       direccion = COALESCE($2, direccion),
       telefono = COALESCE($3, telefono),
       email = COALESCE($4, email),
       descripcion = COALESCE($5, descripcion),
       estado = COALESCE($6, estado),
       lugar_entrenamiento = COALESCE($7, lugar_entrenamiento),
       entrenador_id = COALESCE($8, entrenador_id),
       fecha_actualizacion = CURRENT_TIMESTAMP
     WHERE id = $9
     RETURNING id, lugar_entrenamiento`,
    [nombre, direccion, telefono, email, descripcion, estado, lugar_entrenamiento, entrenador_id ?? null, id]
  )
  if (!rows[0]) return null

  // Si el club tiene (o le acaban de poner) un lugar de entrenamiento,
  // se reparte a todos sus atletas — el del club manda sobre el propio.
  if (rows[0].lugar_entrenamiento) {
    await pool.query(
      `UPDATE atletas SET lugar_entrenamiento = $1 WHERE club_id = $2`,
      [rows[0].lugar_entrenamiento, id]
    )
  }

  return findById(id)
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

//Obtener entrenadores de un club (para el combo de "Entrenador Principal"
//del perfil del club — agrega entrenador_id, que es el id que hay que
//guardar; el "id" de hasta arriba se deja igual que antes por compatibilidad
//con quien ya lo esté usando como id de usuario)
export const findEntrenadoresByClub = async (clubId) => {
  const { rows } = await pool.query(
    `SELECT 
      u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
      u.email, u.telefono,
      e.id AS entrenador_id,
      e.anos_experiencia, e.estado
     FROM entrenadores e
     JOIN usuarios u ON e.usuario_id = u.id
     WHERE e.club_id = $1 AND e.estado = 'activo'
     ORDER BY u.apellido_paterno ASC`,
    [clubId]
  )
  return rows
}