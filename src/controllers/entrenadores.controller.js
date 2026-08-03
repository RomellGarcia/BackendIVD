import * as EntrenadoresModel from '../models/entrenadores.model.js'

// Lista todos los entrenadores con filtros opcionales
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

// Obtiene entrenadores de un club específico
export const getByClub = async (req, res, next) => {
  try {
    const entrenadores = await EntrenadoresModel.findByClub(req.params.clubId)
    res.json({ entrenadores })
  } catch (err) { next(err) }
}

// Obtiene un entrenador por ID
export const getById = async (req, res, next) => {
  try {
    const entrenador = await EntrenadoresModel.findById(req.params.id)
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ entrenador })
  } catch (err) { next(err) }
}

// Obtiene solicitudes de club para un entrenador (filtro opcional por tipo)
export const getSolicitudesByClub = async (req, res, next) => {
  try {
    const solicitudes = await EntrenadoresModel.findSolicitudesByClub(
      req.params.clubId,
      req.query.tipo
    )
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

// Actualiza el estado de una solicitud (aceptada/rechazada)
export const updateSolicitud = async (req, res, next) => {
  try {
    const solicitudActualizada = await EntrenadoresModel.updateSolicitud(
      req.params.solicitudId,
      req.body.estado,
      { clubId: req.clubId ?? null, entrenadorId: req.entrenadorId ?? null }
    )
    if (solicitudActualizada?.error) return res.status(403).json({ error: solicitudActualizada.error })
    if (!solicitudActualizada) return res.status(404).json({ error: 'Solicitud no encontrada' })
    res.json({ mensaje: 'Solicitud actualizada correctamente', solicitud: solicitudActualizada })
  } catch (err) { next(err) }
}

// Invita a un entrenador independiente a un club
export const invitarClub = async (req, res, next) => {
  try {
    const invitacion = await EntrenadoresModel.crearInvitacionClub({
      entrenadorId: req.params.id,
      clubId: req.body.club_id
    })
    if (invitacion.error) return res.status(400).json({ error: invitacion.error })
    if (invitacion.estado === 'aceptada') return res.status(200).json({ mensaje: 'El entrenador ya te había solicitado unirse — quedó asociado automáticamente' })
    res.status(201).json({ mensaje: 'Invitación enviada correctamente', solicitud: invitacion.solicitud })
  } catch (err) { next(err) }
}

// Actualiza un entrenador por parte del administrador
export const updateAdmin = async (req, res, next) => {
  try {
    const entrenador = await EntrenadoresModel.updateAdmin(req.params.id, req.body)
    if (!entrenador) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ mensaje: 'Entrenador actualizado correctamente', entrenador })
  } catch (err) { next(err) }
}

// Asigna o quita un club a un entrenador (verifica permisos según rol)
export const updateClub = async (req, res, next) => {
  try {
    const actorClubId = req.esAdmin ? null : req.clubId
    const resultado = await EntrenadoresModel.updateClub(req.params.id, req.body.club_id, actorClubId)
    if (resultado?.error) return res.status(403).json({ error: resultado.error })
    if (!resultado) return res.status(404).json({ error: 'Entrenador no encontrado' })
    res.json({ mensaje: 'Club actualizado correctamente', entrenador: resultado })
  } catch (err) { next(err) }
}

// Elimina un entrenador (solo admin) - bloqueado si tiene resultados asociados
export const remove = async (req, res, next) => {
  try {
    const resultado = await EntrenadoresModel.remove(req.params.id)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Entrenador eliminado correctamente' })
  } catch (err) { next(err) }
}