import * as ClubModel from '../models/club.model.js'

export const getAll = async (req, res, next) => {
  try {
    const clubes = await ClubModel.findAll()
    res.json({ clubes })
  } catch (err) { next(err) }
}

export const getById = async (req, res, next) => {
  try {
    const club = await ClubModel.findById(req.params.id)
    if (!club) return res.status(404).json({ error: 'Club no encontrado' })
    res.json({ club })
  } catch (err) { next(err) }
}

export const create = async (req, res, next) => {
  try {
    const club = await ClubModel.create(req.body)
    res.status(201).json({ mensaje: 'Club creado exitosamente', club })
  } catch (err) { next(err) }
}

export const update = async (req, res, next) => {
  try {
    const club = await ClubModel.update(req.params.id, req.body)
    if (!club) return res.status(404).json({ error: 'Club no encontrado' })
    res.json({ mensaje: 'Club actualizado', club })
  } catch (err) { next(err) }
}

export const remove = async (req, res, next) => {
  try {
    const result = await ClubModel.softDelete(req.params.id)
    if (!result) return res.status(404).json({ error: 'Club no encontrado' })
    res.json({ mensaje: 'Club desactivado correctamente' })
  } catch (err) { next(err) }
}

export const getAtletas = async (req, res, next) => {
  try {
    const atletas = await ClubModel.findAtletasByClub(req.params.id)
    res.json({ atletas })
  } catch (err) { next(err) }
}

export const getEntrenadores = async (req, res, next) => {
  try {
    const entrenadores = await ClubModel.findEntrenadoresByClub(req.params.id)
    res.json({ entrenadores })
  } catch (err) { next(err) }
}