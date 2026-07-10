import * as EventoModel from '../models/evento.model.js'
import * as InscripcionModel from '../models/inscripcion.model.js'
import cloudinary from 'cloudinary'

export const getAll = async (req, res, next) => {
  try {
    const eventos = await EventoModel.findAll(req.query.limit)
    res.json({ eventos })
  } catch (err) { next(err) }
}

export const getById = async (req, res, next) => {
  try {
    const evento = await EventoModel.findById(req.params.id)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ evento })
  } catch (err) { next(err) }
}

export const create = async (req, res, next) => {
  try {
    const body = { ...req.body }

    // Si no viene fecha_cierre, calcularla 24h antes del evento
    if (!body.fecha_cierre) {
      const fechaEvento = new Date(body.fecha)
      body.fecha_cierre = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }

    // ── Novedad: Subir imagen a Cloudinary si viene en la petición ──
    if (req.files && req.files.imagen) {
      const result = await cloudinary.v2.uploader.upload(req.files.imagen.tempFilePath, {
        folder: 'ivd_eventos' // Se creará esta carpeta en tu Cloudinary para mantener el orden
      })
      body.imagen_url = result.secure_url // Guardamos la URL segura que nos devuelve Cloudinary
    }

    const evento = await EventoModel.create(body)
    res.status(201).json({ evento })
  } catch (err) { next(err) }
}

export const addConvocatoria = async (req, res, next) => {
  try {
    const evento = await EventoModel.findById(req.params.id)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    const convocatoria = await EventoModel.addConvocatoria(req.params.id, req.body)
    res.status(201).json({ convocatoria })
  } catch (err) { next(err) }
}

export const updateFechaCierre = async (req, res, next) => {
  try {
    const evento = await EventoModel.updateFechaCierre(req.params.id, req.body.fecha_cierre)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ mensaje: 'Fecha de cierre actualizada', evento })
  } catch (err) { next(err) }
}

export const getParticipantes = async (req, res, next) => {
  try {
    const participantes = await InscripcionModel.findByEvento(req.params.id)
    res.json({ participantes })
  } catch (err) { next(err) }
}

// Requiere que req.atletaId venga de un middleware checkAtleta (igual que checkEntrenador)
export const getConvocatoriasParaAtleta = async (req, res, next) => {
  try {
    const convocatorias = await InscripcionModel.findConvocatoriasParaAtleta(req.atletaId)
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

export const inscribir = async (req, res, next) => {
  try {
    const resultado = await InscripcionModel.inscribir({
      atletaId: req.atletaId,
      convocatoriaId: req.body.convocatoria_id
    })
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.status(201).json({ mensaje: 'Inscripción exitosa', inscripcion: resultado.inscripcion })
  } catch (err) { next(err) }
}

export const getInscripcionesByAtleta = async (req, res, next) => {
  try {
    const inscripciones = await InscripcionModel.findByAtleta(req.atletaId)
    res.json({ inscripciones })
  } catch (err) { next(err) }
}

export const getConvocatoriasAbiertas = async (req, res, next) => {
  try {
    const convocatorias = await InscripcionModel.findConvocatoriasAbiertas()
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

// Requiere que req.clubId venga del middleware checkClub
export const inscribirAtletaClub = async (req, res, next) => {
  try {
    const perteneceAlClub = await InscripcionModel.atletaPerteneceAClub(req.body.atleta_id, req.clubId)
    if (!perteneceAlClub) return res.status(403).json({ error: 'Ese atleta no pertenece a tu club' })

    const resultado = await InscripcionModel.inscribir({
      atletaId: req.body.atleta_id,
      convocatoriaId: req.body.convocatoria_id
    })
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.status(201).json({ mensaje: 'Atleta inscrito correctamente', inscripcion: resultado.inscripcion })
  } catch (err) { next(err) }
}

export const getInscripcionesByClub = async (req, res, next) => {
  try {
    const inscripciones = await InscripcionModel.findByClub(req.clubId)
    res.json({ inscripciones })
  } catch (err) { next(err) }
}

export const cancelarInscripcion = async (req, res, next) => {
  try {
    const resultado = await InscripcionModel.cancelar(req.params.id, req.atletaId)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Inscripción cancelada correctamente' })
  } catch (err) { next(err) }
}