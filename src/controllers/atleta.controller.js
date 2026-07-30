import * as AtletaModel from '../models/atleta.model.js'

// Obtiene el perfil del atleta autenticado
export const getPerfil = async (req, res, next) => {
  try {
    const perfil = await AtletaModel.findByUsuarioId(req.usuarioId)
    if (!perfil) return res.status(404).json({ error: 'Perfil de atleta no encontrado' })
    res.json({ atleta: perfil })
  } catch (err) { next(err) }
}

// Lista atletas con filtros opcionales
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

// Busca un atleta por su ID
export const getById = async (req, res, next) => {
  try {
    const atleta = await AtletaModel.findById(req.params.id)
    if (!atleta) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ atleta })
  } catch (err) { next(err) }
}

// Actualiza el perfil del atleta autenticado
export const updatePerfil = async (req, res, next) => {
  try {
    await AtletaModel.updatePerfil(req.atletaId, req.usuarioId, req.body)
    res.json({ mensaje: 'Perfil actualizado correctamente' })
  } catch (err) { next(err) }
}

// Actualiza un atleta por parte del administrador
export const updateAdmin = async (req, res, next) => {
  try {
    const atletaActualizado = await AtletaModel.updateAdmin(req.params.id, req.body)
    if (!atletaActualizado) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ mensaje: 'Atleta actualizado correctamente', atleta: atletaActualizado })
  } catch (err) { next(err) }
}

// Asigna o quita un club a un atleta 
export const updateClub = async (req, res, next) => {
  try {
    const clubIdActor = req.esAdmin ? null : req.clubId 
    const resultado = await AtletaModel.updateClub(req.params.id, req.body.club_id, clubIdActor)
    if (resultado?.error) return res.status(403).json({ error: resultado.error })
    if (!resultado) return res.status(404).json({ error: 'Atleta no encontrado' })
    res.json({ mensaje: 'Club actualizado correctamente', atleta: resultado })
  } catch (err) { next(err) }
}

// Elimina un atleta 
export const remove = async (req, res, next) => {
  try {
    const resultado = await AtletaModel.remove(req.params.id)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Atleta eliminado correctamente' })
  } catch (err) { next(err) }
}

// Crea una solicitud de asociación a un club
export const crearSolicitudClub = async (req, res, next) => {
  try {
    const resultado = await AtletaModel.crearSolicitudClub({
      atletaId: req.atletaId,
      clubId:   req.body.club_id,
      tipo:     req.body.tipo
    })
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    if (resultado.ok) return res.status(200).json({ mensaje: 'El club ya te había invitado — quedaste asociado automáticamente' })
    res.status(201).json({ mensaje: 'Solicitud enviada correctamente', solicitud: resultado.solicitud })
  } catch (err) { next(err) }
}

// Lista solicitudes de club con filtros opcionales
export const getSolicitudesClub = async (req, res, next) => {
  try {
    const { club_id, atleta_id, tipo } = req.query
    const solicitudes = await AtletaModel.findSolicitudesClub({
      clubId:   club_id   ? parseInt(club_id)   : undefined,
      atletaId: atleta_id ? parseInt(atleta_id) : undefined,
      tipo
    })
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

// Acepta o rechaza una solicitud de club 
export const procesarSolicitudClub = async (req, res, next) => {
  try {
    const resultado = await AtletaModel.procesarSolicitudClub(req.params.id, req.body.estado)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Solicitud procesada correctamente' })
  } catch (err) { next(err) }
}

// Invita a un atleta a un club
export const invitarClub = async (req, res, next) => {
  try {
    const resultado = await AtletaModel.crearInvitacionClub({
      atletaId: req.params.id,
      clubId:   req.clubId
    })
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    if (resultado.ok) return res.status(200).json({ mensaje: 'El atleta ya te había solicitado unirse — quedó asociado automáticamente' })
    res.status(201).json({ mensaje: 'Invitación enviada correctamente', solicitud: resultado.solicitud })
  } catch (err) { next(err) }
}