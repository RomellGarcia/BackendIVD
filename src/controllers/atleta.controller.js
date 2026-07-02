import * as AtletaModel from '../models/atleta.model.js'

export const getPerfil = async (req, res, next) => {
  try {
    const perfil = await AtletaModel.findByUsuarioId(req.usuarioId)
    if (!perfil) return res.status(404).json({ error: 'Perfil de atleta no encontrado' })
    res.json({ atleta: perfil })
  } catch (err) { next(err) }
}

export const getAll = async (req, res, next) => {
  try {
    const { club_id, sin_club } = req.query
    const atletas = await AtletaModel.findAll({
      clubId:  club_id ? parseInt(club_id) : undefined,
      sinClub: sin_club === 'true'
    })
    res.json({ atletas })
  } catch (err) { next(err) }
}

export const getById = async (req, res, next) => {
  try {
    const atleta = await AtletaModel.findById(req.params.id)
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ atleta })
  } catch (err) { next(err) }
}

export const updatePerfil = async (req, res, next) => {
  try {
    await AtletaModel.updatePerfil(req.atletaId, req.usuarioId, req.body)
    res.json({ mensaje: 'Perfil actualizado correctamente' })
  } catch (err) { next(err) }
}

export const updateAdmin = async (req, res, next) => {
  try {
    const atleta = await AtletaModel.updateAdmin(req.params.id, req.body)
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ mensaje: 'Atleta actualizado correctamente', atleta })
  } catch (err) { next(err) }
}

export const updateClub = async (req, res, next) => {
  try {
    const atleta = await AtletaModel.updateClub(req.params.id, req.body.club_id)
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ mensaje: 'Club actualizado correctamente', atleta })
  } catch (err) { next(err) }
}

export const remove = async (req, res, next) => {
  try {
    const result = await AtletaModel.remove(req.params.id)
    if (result.error) return res.status(400).json({ error: result.error })
    res.json({ mensaje: 'Atleta eliminado correctamente' })
  } catch (err) { next(err) }
}

export const crearSolicitudClub = async (req, res, next) => {
  try {
    const result = await AtletaModel.crearSolicitudClub({
      atletaId: req.atletaId,
      clubId:   req.body.club_id,
      tipo:     req.body.tipo
    })
    if (result.error) return res.status(400).json({ error: result.error })
    res.status(201).json({ mensaje: 'Solicitud enviada correctamente', solicitud: result.solicitud })
  } catch (err) { next(err) }
}

export const getSolicitudesClub = async (req, res, next) => {
  try {
    const { club_id, atleta_id } = req.query
    const solicitudes = await AtletaModel.findSolicitudesClub({
      clubId:   club_id   ? parseInt(club_id)   : undefined,
      atletaId: atleta_id ? parseInt(atleta_id) : undefined
    })
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

export const procesarSolicitudClub = async (req, res, next) => {
  try {
    const result = await AtletaModel.procesarSolicitudClub(req.params.id, req.body.estado)
    if (result.error) return res.status(400).json({ error: result.error })
    res.json({ mensaje: 'Solicitud procesada correctamente' })
  } catch (err) { next(err) }
}