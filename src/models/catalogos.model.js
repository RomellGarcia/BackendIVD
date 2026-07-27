import { pool } from '../config/db.js'

// Obtiene todas las disciplinas deportivas
export const findDisciplinas = async () => {
  const { rows } = await pool.query(`SELECT id, nombre FROM disciplinas ORDER BY nombre ASC`)
  return rows
}

// Obtiene todas las categorías (edad mínima y máxima)
export const findCategorias = async () => {
  const { rows } = await pool.query(`SELECT id, nombre, edad_min, edad_max FROM categorias ORDER BY edad_min ASC`)
  return rows
}

// Obtiene todos los géneros
export const findGeneros = async () => {
  const { rows } = await pool.query(`SELECT id, nombre FROM generos ORDER BY id ASC`)
  return rows
}