import * as EventoModel from '../models/evento.model.js'
import * as InscripcionModel from '../models/inscripcion.model.js'
import cloudinary from 'cloudinary'
import { borrarDeCloudinary } from '../services/cloudinaryCleanup.service.js'

// Convierte el título del evento en un nombre de carpeta seguro (sin
// acentos, espacios ni símbolos raros) y le agrega una marca de tiempo
// para que dos eventos con el mismo título no compartan carpeta.
const nombreCarpetaEvento = (titulo) => {
  const slug = (titulo || 'evento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `ivd_eventos/${Date.now()}_${slug}`
}

export const getAll = async (req, res, next) => {
  try {
    const todos = req.query.todos === 'true'
    const eventos = await EventoModel.findAll(req.query.limit, todos)
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

    if (!body.fecha_cierre) {
      const fechaEvento = new Date(body.fecha)
      body.fecha_cierre = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }

    const carpetaEvento = nombreCarpetaEvento(body.titulo)

    if (req.files && req.files.imagen) {
      const result = await cloudinary.v2.uploader.upload(req.files.imagen.tempFilePath, {
        folder: carpetaEvento,
        use_filename: true,
      })
      body.imagen_url = result.secure_url
      body.imagen_public_id = result.public_id
    }

    if (req.files && req.files.documentoConvocatoria) {
      const result = await cloudinary.v2.uploader.upload(req.files.documentoConvocatoria.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_convocatoria_url = result.secure_url
      body.documento_convocatoria_public_id = result.public_id
    }

    if (req.files && req.files.documentoDeslinde) {
      const result = await cloudinary.v2.uploader.upload(req.files.documentoDeslinde.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_deslinde_url = result.secure_url
      body.documento_deslinde_public_id = result.public_id
    }

    const evento = await EventoModel.create(body)
    res.status(201).json({ evento })
  } catch (err) { next(err) }
}

// Editar datos del evento, y opcionalmente reemplazar imagen/documentos.
// Si se sube un archivo nuevo, borra el anterior de Cloudinary.
export const update = async (req, res, next) => {
  try {
    const evento = await EventoModel.findById(req.params.id)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })

    const body = { ...req.body }
    const carpetaEvento = nombreCarpetaEvento(body.titulo || evento.titulo)

    if (req.files && req.files.imagen) {
      const result = await cloudinary.v2.uploader.upload(req.files.imagen.tempFilePath, {
        folder: carpetaEvento,
        use_filename: true,
      })
      body.imagen_url = result.secure_url
      body.imagen_public_id = result.public_id
      await borrarDeCloudinary(evento.imagen_public_id)
    }

    if (req.files && req.files.documentoConvocatoria) {
      const result = await cloudinary.v2.uploader.upload(req.files.documentoConvocatoria.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_convocatoria_url = result.secure_url
      body.documento_convocatoria_public_id = result.public_id
      await borrarDeCloudinary(evento.documento_convocatoria_public_id)
    }

    if (req.files && req.files.documentoDeslinde) {
      const result = await cloudinary.v2.uploader.upload(req.files.documentoDeslinde.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_deslinde_url = result.secure_url
      body.documento_deslinde_public_id = result.public_id
      await borrarDeCloudinary(evento.documento_deslinde_public_id)
    }

    const actualizado = await EventoModel.update(req.params.id, body)
    res.json({ evento: actualizado })
  } catch (err) { next(err) }
}

// Marcar el evento como activo/cerrado (no lo borra)
export const toggleEstado = async (req, res, next) => {
  try {
    const evento = await EventoModel.toggleEstado(req.params.id, req.body.estado)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ mensaje: 'Estado actualizado', evento })
  } catch (err) { next(err) }
}

// Eliminar una convocatoria (saca y notifica a los inscritos)
export const deleteConvocatoria = async (req, res, next) => {
  try {
    const resultado = await EventoModel.removeConvocatoria(req.params.convocatoriaId)
    if (resultado.error) return res.status(404).json({ error: resultado.error })
    res.json({ mensaje: 'Convocatoria eliminada', atletasAfectados: resultado.atletasAfectados })
  } catch (err) { next(err) }
}

// Eliminar el evento completo (saca y notifica a todos los inscritos,
// borra sus archivos de Cloudinary)
export const deleteEvento = async (req, res, next) => {
  try {
    const resultado = await EventoModel.remove(req.params.id)
    if (resultado.error) return res.status(404).json({ error: resultado.error })

    const { imagen, documentoConvocatoria, documentoDeslinde } = resultado.archivosCloudinary
    await Promise.all([
      borrarDeCloudinary(imagen),
      borrarDeCloudinary(documentoConvocatoria),
      borrarDeCloudinary(documentoDeslinde),
    ])

    res.json({ mensaje: 'Evento eliminado', atletasAfectados: resultado.atletasAfectados })
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

// Admin da de baja a un atleta de una convocatoria (a diferencia de
// cancelarInscripcion, que es para que el propio atleta se autocancele)
export const removerAtletaDeConvocatoria = async (req, res, next) => {
  try {
    const resultado = await InscripcionModel.removerPorAdmin(req.params.inscripcionId)
    if (resultado.error) return res.status(404).json({ error: resultado.error })
    res.json({ mensaje: 'Atleta dado de baja de la convocatoria' })
  } catch (err) { next(err) }
}

//AGREGAR AL FINAL DE evento.controller.js

export const getConvocatoriasDeEvento = async (req, res, next) => {
  try {
    const convocatorias = await EventoModel.findConvocatoriasByEvento(req.params.id)
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

export const subirResultadoConvocatoria = async (req, res, next) => {
  try {
    if (!req.files || !req.files.documentoResultado) {
      return res.status(400).json({ error: 'Falta el archivo de resultados' })
    }
    const convocatoriaId = req.params.convocatoriaId
    const actual = await EventoModel.findConvocatoriaById(convocatoriaId)
    if (!actual) return res.status(404).json({ error: 'Convocatoria no encontrada' })

    const result = await cloudinary.v2.uploader.upload(req.files.documentoResultado.tempFilePath, {
      folder: `ivd_resultados/convocatoria_${convocatoriaId}`,
      resource_type: 'auto',
      use_filename: true,
    })

    if (actual.documento_resultado_public_id) {
      await borrarDeCloudinary(actual.documento_resultado_public_id)
    }

    const actualizada = await EventoModel.subirDocumentoResultado(convocatoriaId, {
      url: result.secure_url,
      publicId: result.public_id,
    })
    res.json({ mensaje: 'Resultado subido correctamente', convocatoria: actualizada })
  } catch (err) { next(err) }
}

export const eliminarResultadoConvocatoria = async (req, res, next) => {
  try {
    const publicId = await EventoModel.eliminarDocumentoResultado(req.params.convocatoriaId)
    if (publicId) await borrarDeCloudinary(publicId)
    res.json({ mensaje: 'Documento de resultados eliminado' })
  } catch (err) { next(err) }
}

export const getParticipantesPorConvocatoria = async (req, res, next) => {
  try {
    const participantes = await InscripcionModel.findByConvocatoria(req.params.convocatoriaId)
    res.json({ participantes })
  } catch (err) { next(err) }
}

// Editar disciplina/categoría/género de una convocatoria (sin borrarla)
export const updateConvocatoria = async (req, res, next) => {
  try {
    const actualizada = await EventoModel.updateConvocatoria(req.params.convocatoriaId, req.body)
    if (!actualizada) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    res.json({ mensaje: 'Convocatoria actualizada', convocatoria: actualizada })
  } catch (err) { next(err) }
}