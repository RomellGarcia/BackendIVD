import * as EntrenadoresModel from '../models/entrenadores.model.js'

export const getAll = async (req, res, next) => {
  try {
    const { club_id, sin_club } = req.query
    const entrenadores = await EntrenadoresModel.findAll({
      clubId: club_id ? parseInt(club_id) : undefined,
      sinClub: sin_club === 'true'
    })
    res.json({ entrenadores })
  } catch (err) { next(err) }
}

export const getByClub = async (req, res, next) => {
  try {
    const entrenadores = await EntrenadoresModel.findByClub(req.params.clubId)
    res.json({ entrenadores })
  } catch (err) { next(err) }
}

export const getById = async (req, res, next) => {
  try {
    const entrenador = await EntrenadoresModel.findById(req.params.id)
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ entrenador })
  } catch (err) { next(err) }
}

//AJUSTE: se agrega el filtro opcional `tipo` para separar, del lado del
//club, las solicitudes recibidas de entrenadores de las invitaciones que
//el propio club envió.
export const getSolicitudesByClub = async (req, res, next) => {
  try {
    const solicitudes = await EntrenadoresModel.findSolicitudesByClub(
      req.params.clubId,
      req.query.tipo
    )
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

//NUEVO: el club invita a un entrenador independiente.
export const invitarClub = async (req, res, next) => {
  try {
    const result = await EntrenadoresModel.crearInvitacionClub({
      entrenadorId: req.params.id,
      clubId: req.body.club_id
    })
    if (result.error) return res.status(400).json({ error: result.error })
    res.status(201).json({ mensaje: 'Invitación enviada correctamente', solicitud: result.solicitud })
  } catch (err) { next(err) }
}

export const updateAdmin = async (req, res, next) => {
  try {
    const entrenador = await EntrenadoresModel.updateAdmin(req.params.id, req.body)
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ mensaje: 'Entrenador actualizado correctamente', entrenador })
  } catch (err) { next(err) }
}

export const updateClub = async (req, res, next) => {
  try {
    const entrenador = await EntrenadoresModel.updateClub(req.params.id, req.body.club_id)
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ mensaje: 'Club actualizado correctamente', entrenador })
  } catch (err) { next(err) }
}