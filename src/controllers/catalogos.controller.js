import * as CatalogosModel from '../models/catalogos.model.js'

// Obtiene todas las disciplinas deportivas
export const getDisciplinas = async (req, res, next) => {
  try {
    const disciplinas = await CatalogosModel.findDisciplinas()
    res.json({ disciplinas })
  } catch (err) { next(err) }
}

// Obtiene todas las categorías (por edad, peso, etc.)
export const getCategorias = async (req, res, next) => {
  try {
    const categorias = await CatalogosModel.findCategorias()
    res.json({ categorias })
  } catch (err) { next(err) }
}

// Obtiene todos los géneros disponibles (masculino, femenino, etc.)
export const getGeneros = async (req, res, next) => {
  try {
    const generos = await CatalogosModel.findGeneros()
    res.json({ generos })
  } catch (err) { next(err) }
}