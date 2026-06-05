import * as EntrenadoresModel from '../models/entrenadores.model.js'

export const getByClub = async (req, res, next) => {
  try {
    const entrenadores = await EntrenadoresModel.findByClub(req.params.clubId)
    res.json({ entrenadores })
  } catch (err) { next(err) }
}

export const getSolicitudesByClub = async (req, res, next) => {
  try {
    const solicitudes = await EntrenadoresModel.findSolicitudesByClub(req.params.clubId)
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

export const updateSolicitud = async (req, res, next) => {
  try {
    const solicitud = await EntrenadoresModel.updateSolicitud(
      req.params.solicitudId,
      req.body.estado
    )
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' })
    res.json({ mensaje: 'Solicitud actualizada correctamente', solicitud })
  } catch (err) { next(err) }
}