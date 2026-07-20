import { pool } from '../config/db.js'

export const findDisciplinas = async () => {
  const { rows } = await pool.query(`SELECT id, nombre FROM disciplinas ORDER BY nombre ASC`)
  return rows
}

export const findCategorias = async () => {
  const { rows } = await pool.query(`SELECT id, nombre, edad_min, edad_max FROM categorias ORDER BY edad_min ASC`)
  return rows
}

export const findGeneros = async () => {
  const { rows } = await pool.query(`SELECT id, nombre FROM generos ORDER BY id ASC`)
  return rows
}