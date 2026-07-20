import * as NotificacionModel from '../models/notificacion.model.js'

// Requiere requireAuth + checkAtleta (usa req.atletaId)
export const getMisNotificaciones = async (req, res, next) => {
  try {
    const notificaciones = await NotificacionModel.findNoLeidasByAtleta(req.atletaId)
    res.json({ notificaciones })
  } catch (err) { next(err) }
}

export const marcarLeidas = async (req, res, next) => {
  try {
    await NotificacionModel.marcarLeidasByAtleta(req.atletaId, req.body.ids)
    res.json({ mensaje: 'Notificaciones marcadas como leídas' })
  } catch (err) { next(err) }
}

export const getMisNotificacionesClub = async (req, res, next) => {
  try {
    const notificaciones = await NotificacionModel.findNoLeidasByClub(req.clubId)
    res.json({ notificaciones })
  } catch (err) { next(err) }
}

export const marcarLeidasClub = async (req, res, next) => {
  try {
    await NotificacionModel.marcarLeidasByClub(req.clubId, req.body.ids)
    res.json({ mensaje: 'Notificaciones marcadas como leídas' })
  } catch (err) { next(err) }
}