import * as EventoModel from '../models/evento.model.js'
import * as InscripcionModel from '../models/inscripcion.model.js'
import cloudinary from 'cloudinary'
import { borrarDeCloudinary } from '../services/cloudinaryCleanup.service.js'

// Genera un nombre de carpeta único basado en el título del evento
const nombreCarpetaEvento = (titulo) => {
  const slug = (titulo || 'evento')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `ivd_eventos/${Date.now()}_${slug}`
}

// Lista eventos con opción de incluir los finalizados
export const getAll = async (req, res, next) => {
  try {
    const incluirTodos = req.query.todos === 'true'
    const listaEventos = await EventoModel.findAll(req.query.limit, incluirTodos)
    res.json({ eventos: listaEventos })
  } catch (err) { next(err) }
}

// Obtiene un evento por ID
export const getById = async (req, res, next) => {
  try {
    const evento = await EventoModel.findById(req.params.id)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ evento })
  } catch (err) { next(err) }
}

// Crea un evento, subiendo imagen y documentos a Cloudinary si existen
export const create = async (req, res, next) => {
  try {
    const body = { ...req.body }
    // Asigna fecha de cierre automática (un día antes del evento) si no se envía
    if (!body.fecha_cierre) {
      const fechaEvento = new Date(body.fecha)
      body.fecha_cierre = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000).toISOString()
    }

    const carpetaEvento = nombreCarpetaEvento(body.titulo)

    // Sube imagen principal
    if (req.files && req.files.imagen) {
      const resultadoImagen = await cloudinary.v2.uploader.upload(req.files.imagen.tempFilePath, {
        folder: carpetaEvento,
        use_filename: true,
      })
      body.imagen_url = resultadoImagen.secure_url
      body.imagen_public_id = resultadoImagen.public_id
    }

    // Sube documento de convocatoria
    if (req.files && req.files.documentoConvocatoria) {
      const resultadoDoc = await cloudinary.v2.uploader.upload(req.files.documentoConvocatoria.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_convocatoria_url = resultadoDoc.secure_url
      body.documento_convocatoria_public_id = resultadoDoc.public_id
    }

    // Sube documento de deslinde
    if (req.files && req.files.documentoDeslinde) {
      const resultadoDeslinde = await cloudinary.v2.uploader.upload(req.files.documentoDeslinde.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_deslinde_url = resultadoDeslinde.secure_url
      body.documento_deslinde_public_id = resultadoDeslinde.public_id
    }

    const eventoCreado = await EventoModel.create(body)
    res.status(201).json({ evento: eventoCreado })
  } catch (err) { next(err) }
}

// Actualiza evento, reemplazando archivos si se envían nuevos
export const update = async (req, res, next) => {
  try {
    const eventoExistente = await EventoModel.findById(req.params.id)
    if (!eventoExistente) return res.status(404).json({ error: 'Evento no encontrado' })

    const body = { ...req.body }
    const carpetaEvento = nombreCarpetaEvento(body.titulo || eventoExistente.titulo)
    // Reemplaza imagen
    if (req.files && req.files.imagen) {
      const resultadoImagen = await cloudinary.v2.uploader.upload(req.files.imagen.tempFilePath, {
        folder: carpetaEvento,
        use_filename: true,
      })
      body.imagen_url = resultadoImagen.secure_url
      body.imagen_public_id = resultadoImagen.public_id
      await borrarDeCloudinary(eventoExistente.imagen_public_id)
    }

    // Reemplaza documento de convocatoria
    if (req.files && req.files.documentoConvocatoria) {
      const resultadoDoc = await cloudinary.v2.uploader.upload(req.files.documentoConvocatoria.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_convocatoria_url = resultadoDoc.secure_url
      body.documento_convocatoria_public_id = resultadoDoc.public_id
      await borrarDeCloudinary(eventoExistente.documento_convocatoria_public_id)
    }

    // Reemplaza documento de deslinde
    if (req.files && req.files.documentoDeslinde) {
      const resultadoDeslinde = await cloudinary.v2.uploader.upload(req.files.documentoDeslinde.tempFilePath, {
        folder: carpetaEvento,
        resource_type: 'auto',
        use_filename: true,
      })
      body.documento_deslinde_url = resultadoDeslinde.secure_url
      body.documento_deslinde_public_id = resultadoDeslinde.public_id
      await borrarDeCloudinary(eventoExistente.documento_deslinde_public_id)
    }

    const eventoActualizado = await EventoModel.update(req.params.id, body)
    res.json({ evento: eventoActualizado })
  } catch (err) { next(err) }
}

// Activa o desactiva un evento (cambia estado)
export const toggleEstado = async (req, res, next) => {
  try {
    const evento = await EventoModel.toggleEstado(req.params.id, req.body.estado)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ mensaje: 'Estado actualizado', evento })
  } catch (err) { next(err) }
}

// Finaliza o reabre un evento (afecta a sus convocatorias)
export const toggleFinalizadoEvento = async (req, res, next) => {
  try {
    const evento = await EventoModel.toggleFinalizadoEvento(req.params.id, req.body.finalizado)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ mensaje: 'Evento actualizado', evento })
  } catch (err) { next(err) }
}

// Elimina una convocatoria (notifica a inscritos)
export const deleteConvocatoria = async (req, res, next) => {
  try {
    const resultado = await EventoModel.removeConvocatoria(req.params.convocatoriaId)
    if (resultado.error) return res.status(404).json({ error: resultado.error })
    res.json({ mensaje: 'Convocatoria eliminada', atletasAfectados: resultado.atletasAfectados })
  } catch (err) { next(err) }
}

// Elimina evento completo y sus archivos de Cloudinary
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

// Actualiza solo la fecha de cierre del evento
export const updateFechaCierre = async (req, res, next) => {
  try {
    const evento = await EventoModel.updateFechaCierre(req.params.id, req.body.fecha_cierre)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    res.json({ mensaje: 'Fecha de cierre actualizada', evento })
  } catch (err) { next(err) }
}

// Lista participantes de un evento
export const getParticipantes = async (req, res, next) => {
  try {
    const participantes = await InscripcionModel.findByEvento(req.params.id)
    res.json({ participantes })
  } catch (err) { next(err) }
}

// Obtiene convocatorias disponibles para un atleta
export const getConvocatoriasParaAtleta = async (req, res, next) => {
  try {
    const convocatorias = await InscripcionModel.findConvocatoriasParaAtleta(req.atletaId)
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

// Inscribe a un atleta en una convocatoria
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

// Lista inscripciones del atleta autenticado
export const getInscripcionesByAtleta = async (req, res, next) => {
  try {
    const inscripciones = await InscripcionModel.findByAtleta(req.atletaId)
    res.json({ inscripciones })
  } catch (err) { next(err) }
}

// Lista convocatorias abiertas (no finalizadas)
export const getConvocatoriasAbiertas = async (req, res, next) => {
  try {
    const convocatorias = await InscripcionModel.findConvocatoriasAbiertas()
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

// Club inscribe a un atleta de su club en una convocatoria
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

// Lista inscripciones de un club
export const getInscripcionesByClub = async (req, res, next) => {
  try {
    const inscripciones = await InscripcionModel.findByClub(req.clubId)
    res.json({ inscripciones })
  } catch (err) { next(err) }
}

// Atleta cancela su propia inscripción
export const cancelarInscripcion = async (req, res, next) => {
  try {
    const resultado = await InscripcionModel.cancelar(req.params.id, req.atletaId)
    if (resultado.error) return res.status(400).json({ error: resultado.error })
    res.json({ mensaje: 'Inscripción cancelada correctamente' })
  } catch (err) { next(err) }
}

// Admin da de baja a un atleta de una convocatoria
export const removerAtletaDeConvocatoria = async (req, res, next) => {
  try {
    const resultado = await InscripcionModel.removerPorAdmin(req.params.inscripcionId)
    if (resultado.error) return res.status(404).json({ error: resultado.error })
    res.json({ mensaje: 'Atleta dado de baja de la convocatoria' })
  } catch (err) { next(err) }
}

// Obtiene todas las convocatorias de un evento
export const getConvocatoriasDeEvento = async (req, res, next) => {
  try {
    const convocatorias = await EventoModel.findConvocatoriasByEvento(req.params.id)
    res.json({ convocatorias })
  } catch (err) { next(err) }
}

// Sube archivo de resultados de una convocatoria
export const subirResultadoConvocatoria = async (req, res, next) => {
  try {
    if (!req.files || !req.files.documentoResultado) {
      return res.status(400).json({ error: 'Falta el archivo de resultados' })
    }
    const convocatoriaId = req.params.convocatoriaId
    const convocatoriaActual = await EventoModel.findConvocatoriaById(convocatoriaId)
    if (!convocatoriaActual) return res.status(404).json({ error: 'Convocatoria no encontrada' })

    const resultadoSubida = await cloudinary.v2.uploader.upload(req.files.documentoResultado.tempFilePath, {
      folder: `ivd_resultados/convocatoria_${convocatoriaId}`,
      resource_type: 'auto',
      use_filename: true,
    })
    // Borra el anterior si existía
    if (convocatoriaActual.documento_resultado_public_id) {
      await borrarDeCloudinary(convocatoriaActual.documento_resultado_public_id)
    }

    const convocatoriaActualizada = await EventoModel.subirDocumentoResultado(convocatoriaId, {
      url: resultadoSubida.secure_url,
      publicId: resultadoSubida.public_id,
    })
    res.json({ mensaje: 'Resultado subido correctamente', convocatoria: convocatoriaActualizada })
  } catch (err) { next(err) }
}

// Elimina el documento de resultados de una convocatoria
export const eliminarResultadoConvocatoria = async (req, res, next) => {
  try {
    const publicId = await EventoModel.eliminarDocumentoResultado(req.params.convocatoriaId)
    if (publicId) await borrarDeCloudinary(publicId)
    res.json({ mensaje: 'Documento de resultados eliminado' })
  } catch (err) { next(err) }
}

// Lista participantes de una convocatoria específica
export const getParticipantesPorConvocatoria = async (req, res, next) => {
  try {
    const participantes = await InscripcionModel.findByConvocatoria(req.params.convocatoriaId)
    res.json({ participantes })
  } catch (err) { next(err) }
}

// Agrega una nueva convocatoria a un evento existente
export const addConvocatoria = async (req, res, next) => {
  try {
    const evento = await EventoModel.findById(req.params.id)
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' })
    const convocatoriaCreada = await EventoModel.addConvocatoria(req.params.id, req.body)
    if (convocatoriaCreada.error) return res.status(400).json({ error: convocatoriaCreada.error })
    res.status(201).json({ convocatoria: convocatoriaCreada })
  } catch (err) { next(err) }
}

// Actualiza los datos de una convocatoria
export const updateConvocatoria = async (req, res, next) => {
  try {
    const convocatoriaActualizada = await EventoModel.updateConvocatoria(req.params.convocatoriaId, req.body)
    if (!convocatoriaActualizada) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    if (convocatoriaActualizada.error) return res.status(400).json({ error: convocatoriaActualizada.error })
    res.json({ mensaje: 'Convocatoria actualizada', convocatoria: convocatoriaActualizada })
  } catch (err) { next(err) }
}

// Abre o cierra una convocatoria (estado)
export const toggleEstadoConvocatoria = async (req, res, next) => {
  try {
    const convocatoria = await EventoModel.toggleEstadoConvocatoria(req.params.convocatoriaId, req.body.estado)
    if (!convocatoria) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    res.json({ mensaje: 'Estado de la convocatoria actualizado', convocatoria })
  } catch (err) { next(err) }
}