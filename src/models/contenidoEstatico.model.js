import { pool } from '../config/db.js'

const TIPOS_VALIDOS = ['mision', 'vision', 'politica', 'terminos']

export const validarTipo = (tipo) => TIPOS_VALIDOS.includes(tipo)

//Obtener contenido por tipo
export const findByTipo = async (tipo) => {
  const { rows } = await pool.query(
    `SELECT id, tipo, titulo, contenido, updated_at
     FROM contenido_estatico
     WHERE tipo = $1`,
    [tipo]
  )
  return rows[0] || null
}

//Actualizar si no existe el tipo lo crea, si existe lo actualiza
export const upsert = async (tipo, { titulo, contenido }) => {
  const { rows } = await pool.query(
    `INSERT INTO contenido_estatico (tipo, titulo, contenido)
     VALUES ($1, $2, $3)
     ON CONFLICT (tipo) DO UPDATE
       SET titulo    = EXCLUDED.titulo,
           contenido = EXCLUDED.contenido,
           updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [tipo, titulo, contenido]
  )
  return rows[0]
}