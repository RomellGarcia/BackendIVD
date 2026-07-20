import * as CatalogosModel from '../models/catalogos.model.js'

export const getDisciplinas = async (req, res, next) => {
  try {
    const disciplinas = await CatalogosModel.findDisciplinas()
    res.json({ disciplinas })
  } catch (err) { next(err) }
}

export const getCategorias = async (req, res, next) => {
  try {
    const categorias = await CatalogosModel.findCategorias()
    res.json({ categorias })
  } catch (err) { next(err) }
}

export const getGeneros = async (req, res, next) => {
  try {
    const generos = await CatalogosModel.findGeneros()
    res.json({ generos })
  } catch (err) { next(err) }
}