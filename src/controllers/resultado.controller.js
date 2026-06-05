import * as ResultadoModel from '../models/resultado.model.js'

export const getAll = async (req, res, next) => {
  try {
    const { evento_id, atleta_id, categoria_id, club_id, ano_competitivo, limit } = req.query
    const resultados = await ResultadoModel.findAll({
      eventoId:     evento_id     ? parseInt(evento_id)     : undefined,
      atletaId:     atleta_id     ? parseInt(atleta_id)     : undefined,
      categoriaId:  categoria_id  ? parseInt(categoria_id)  : undefined,
      clubId:       club_id       ? parseInt(club_id)       : undefined,
      anoCompetitivo: ano_competitivo ? parseInt(ano_competitivo) : undefined,
      limit:        limit         ? parseInt(limit)         : 100
    })
    res.json({ resultados })
  } catch (err) { next(err) }
}

export const getById = async (req, res, next) => {
  try {
    const resultado = await ResultadoModel.findById(req.params.id)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ resultado })
  } catch (err) { next(err) }
}

export const getByEvento = async (req, res, next) => {
  try {
    const resultados = await ResultadoModel.findByEvento(req.params.eventoId)
    res.json({ resultados })
  } catch (err) { next(err) }
}

export const getByAtleta = async (req, res, next) => {
  try {
    const resultados = await ResultadoModel.findByAtleta(req.params.atletaId)
    res.json({ resultados })
  } catch (err) { next(err) }
}

export const getByClub = async (req, res, next) => {
  try {
    const resultados = await ResultadoModel.findByClub(req.params.clubId)
    res.json({ resultados })
  } catch (err) { next(err) }
}

export const getByEntrenador = async (req, res, next) => {
  try {
    const resultados = await ResultadoModel.findByEntrenador(req.params.entrenadorId)
    res.json({ resultados })
  } catch (err) { next(err) }
}

export const getEstadisticasGenerales = async (req, res, next) => {
  try {
    const estadisticas = await ResultadoModel.getEstadisticasGenerales()
    res.json({ estadisticas })
  } catch (err) { next(err) }
}

export const getEstadisticasByClub = async (req, res, next) => {
  try {
    const estadisticas = await ResultadoModel.getEstadisticasByClub(req.params.clubId)
    res.json({ estadisticas })
  } catch (err) { next(err) }
}

export const create = async (req, res, next) => {
  try {
    const resultado = await ResultadoModel.create(req.body)
    res.status(201).json({ resultado })
  } catch (err) { next(err) }
}

export const update = async (req, res, next) => {
  try {
    const resultado = await ResultadoModel.update(req.params.id, req.body)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ resultado })
  } catch (err) { next(err) }
}

export const remove = async (req, res, next) => {
  try {
    const result = await ResultadoModel.remove(req.params.id)
    if (!result) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ mensaje: 'Resultado eliminado correctamente' })
  } catch (err) { next(err) }
}