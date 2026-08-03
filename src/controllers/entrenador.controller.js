import * as EntrenadorModel from '../models/entrenador.model.js'

// Obtiene perfil del entrenador autenticado (usuarioId desde token)
export const getPerfil = async (req, res, next) => {
  try {
    const perfil = await EntrenadorModel.findByUsuarioId(req.usuarioId)
    if (!perfil) return res.status(404).json({ error: 'Perfil de entrenador no encontrado' })
    res.json({ entrenador: perfil })
  } catch (err) { next(err) }
}

// Obtiene estadísticas del entrenador
export const getStats = async (req, res, next) => {
  try {
    const estadisticas = await EntrenadorModel.getStats(req.entrenadorId)
    res.json({ stats: estadisticas })
  } catch (err) { next(err) }
}

// Obtiene actividades recientes del entrenador
export const getActividad = async (req, res, next) => {
  try {
    const actividad = await EntrenadorModel.getActividad()
    res.json({ actividad })
  } catch (err) { next(err) }
}

// Lista solicitudes pendientes del entrenador para unirse a clubes
export const getSolicitudes = async (req, res, next) => {
  try {
    const solicitudes = await EntrenadorModel.findSolicitudesByEntrenador(req.entrenadorId)
    res.json({ solicitudes })
  } catch (err) { next(err) }
}

// Envía solicitud de unión a un club
export const solicitarClub = async (req, res, next) => {
  try {
    const { club_id, mensaje } = req.body
    const solicitudCreada = await EntrenadorModel.crearSolicitudClub({
      entrenadorId: req.entrenadorId,
      clubId: club_id,
      mensaje
    })
    if (solicitudCreada.error) return res.status(400).json({ error: solicitudCreada.error })
    if (solicitudCreada.estado === 'aceptada') return res.status(200).json({ mensaje: 'El club ya te había invitado — quedaste asociado automáticamente' })
    res.status(201).json({ mensaje: 'Solicitud enviada correctamente', solicitud: solicitudCreada.solicitud })
  } catch (err) { next(err) }
}

// Actualiza perfil del entrenador
export const updatePerfil = async (req, res, next) => {
  try {
    const { telefono, anos_experiencia, lugar_entrenamiento, certificaciones, especialidades } = req.body

    // Actualiza datos base del perfil
    await EntrenadorModel.updatePerfil(req.entrenadorId, req.usuarioId, { telefono, anos_experiencia, lugar_entrenamiento })

    // Actualiza campos separados si vienen en la petición
    if (certificaciones !== undefined) {
      await EntrenadorModel.updateCertificaciones(req.entrenadorId, certificaciones)
    }
    if (especialidades !== undefined) {
      await EntrenadorModel.updateEspecialidades(req.entrenadorId, especialidades)
    }

    res.json({ mensaje: 'Perfil actualizado correctamente' })
  } catch (err) { next(err) }
}

// El entrenador sale de su club por su cuenta.
export const salirClub = async (req, res, next) => {
  try {
    const resultado = await EntrenadorModel.salirDelClub(req.entrenadorId)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Saliste del club correctamente' })
  } catch (err) { next(err) }
}

// Sugerencias para el autocompletar "Certificaciones"
export const getCertificacionesSugeridas = async (req, res, next) => {
  try {
    const certificaciones = await EntrenadorModel.findCertificacionesSugeridas()
    res.json({ certificaciones })
  } catch (err) { next(err) }
}

// Mismo criterio para especialidades.
export const getEspecialidadesSugeridas = async (req, res, next) => {
  try {
    const especialidades = await EntrenadorModel.findEspecialidadesSugeridas()
    res.json({ especialidades })
  } catch (err) { next(err) }
}