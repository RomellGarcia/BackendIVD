import * as EntrenadorModel from '../models/entrenador.model.js'

// Obtener perfil del entrenador logueado necesitamos el id interno de usuarios via supabase_uid
export const getPerfil = async (req, res, next) => {
  try {
    // req.entrenador lo setea el middleware checkEntrenador
    const perfil = await EntrenadorModel.findByUsuarioId(req.usuarioId)
    if (!perfil) return res.status(404).json({ error: 'Perfil de entrenador no encontrado' })
    res.json({ entrenador: perfil })
  } catch (err) { next(err) }
}

export const getStats = async (req, res, next) => {
  try {
    const stats = await EntrenadorModel.getStats(req.entrenadorId)
    res.json({ stats })
  } catch (err) { next(err) }
}

export const getActividad = async (req, res, next) => {
  try {
    const actividad = await EntrenadorModel.getActividad()
    res.json({ actividad })
  } catch (err) { next(err) }
}

export const getAtletas = async (req, res, next) => {
  try {
    const atletas = await EntrenadorModel.findAtletasByEntrenador(req.entrenadorId)
    res.json({ atletas })
  } catch (err) { next(err) }
}

export const getSolicitudes = async (req, res, next) => {
  try {
    const solicitudes = await EntrenadorModel.findSolicitudesByEntrenador(req.entrenadorId)
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

export const solicitarClub = async (req, res, next) => {
  try {
    const { club_id, mensaje } = req.body
    const resultado = await EntrenadorModel.crearSolicitudClub({
      entrenadorId: req.entrenadorId,
      clubId: club_id,
      mensaje
    })
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.status(201).json({ mensaje: 'Solicitud enviada correctamente', solicitud: resultado.solicitud })
  } catch (err) { next(err) }
}

export const updatePerfil = async (req, res, next) => {
  try {
    const { telefono, anos_experiencia, certificaciones, especialidades } = req.body

    await EntrenadorModel.updatePerfil(req.entrenadorId, req.usuarioId, { telefono, anos_experiencia })

    if (certificaciones !== undefined) {
      await EntrenadorModel.updateCertificaciones(req.entrenadorId, certificaciones)
    }
    if (especialidades !== undefined) {
      await EntrenadorModel.updateEspecialidades(req.entrenadorId, especialidades)
    }

    res.json({ mensaje: 'Perfil actualizado correctamente' })
  } catch (err) { next(err) }
}