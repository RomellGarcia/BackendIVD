import * as ResultadoModel from '../models/resultado.model.js'

// Lista resultados con filtros opcionales (evento, atleta, categoría, club, año, límite)
export const getAll = async (req, res, next) => {
  try {
    const { evento_id, atleta_id, categoria_id, club_id, ano_competitivo, limit } = req.query
    const listaResultados = await ResultadoModel.findAll({
      eventoId:     evento_id     ? parseInt(evento_id)     : undefined,
      atletaId:     atleta_id     ? parseInt(atleta_id)     : undefined,
      categoriaId:  categoria_id  ? parseInt(categoria_id)  : undefined,
      clubId:       club_id       ? parseInt(club_id)       : undefined,
      anoCompetitivo: ano_competitivo ? parseInt(ano_competitivo) : undefined,
      limit:        limit         ? parseInt(limit)         : 100
    })
    res.json({ resultados: listaResultados })
  } catch (err) { next(err) }
}

// Obtiene un resultado por su ID
export const getById = async (req, res, next) => {
  try {
    const resultado = await ResultadoModel.findById(req.params.id)
    if (!resultado) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ resultado })
  } catch (err) { next(err) }
}

// Lista resultados de un evento específico
export const getByEvento = async (req, res, next) => {
  try {
    const resultadosDelEvento = await ResultadoModel.findByEvento(req.params.eventoId)
    res.json({ resultados: resultadosDelEvento })
  } catch (err) { next(err) }
}

// Lista resultados de un atleta en particular
export const getByAtleta = async (req, res, next) => {
  try {
    const resultadosDelAtleta = await ResultadoModel.findByAtleta(req.params.atletaId)
    res.json({ resultados: resultadosDelAtleta })
  } catch (err) { next(err) }
}

// Lista resultados de todos los atletas de un club
export const getByClub = async (req, res, next) => {
  try {
    const resultadosDelClub = await ResultadoModel.findByClub(req.params.clubId)
    res.json({ resultados: resultadosDelClub })
  } catch (err) { next(err) }
}

// Lista resultados de atletas bajo un entrenador
export const getByEntrenador = async (req, res, next) => {
  try {
    const resultadosDelEntrenador = await ResultadoModel.findByEntrenador(req.params.entrenadorId)
    res.json({ resultados: resultadosDelEntrenador })
  } catch (err) { next(err) }
}

// Obtiene estadísticas generales de todos los resultados
export const getEstadisticasGenerales = async (req, res, next) => {
  try {
    const estadisticas = await ResultadoModel.getEstadisticasGenerales()
    res.json({ estadisticas })
  } catch (err) { next(err) }
}

// Obtiene las mejores marcas aplicando filtros (categoría, disciplina, club, año, género)
export const getMejoresMarcas = async (req, res, next) => {
  try {
    const { categoria, disciplina, club, ano_competitivo, genero } = req.query
    const mejoresMarcas = await ResultadoModel.getMejoresMarcas({
      categoria,
      disciplina,
      club,
      anoCompetitivo: ano_competitivo ? parseInt(ano_competitivo) : undefined,
      genero,
    })
    res.json({ marcas: mejoresMarcas })
  } catch (err) { next(err) }
}

// Estadísticas de resultados de un club específico
export const getEstadisticasByClub = async (req, res, next) => {
  try {
    const estadisticasDelClub = await ResultadoModel.getEstadisticasByClub(req.params.clubId)
    res.json({ estadisticas: estadisticasDelClub })
  } catch (err) { next(err) }
}

// Crea un nuevo resultado
export const create = async (req, res, next) => {
  try {
    const resultadoCreado = await ResultadoModel.create(req.body)
    res.status(201).json({ resultado: resultadoCreado })
  } catch (err) { next(err) }
}

// Actualiza un resultado existente
export const update = async (req, res, next) => {
  try {
    const resultadoActualizado = await ResultadoModel.update(req.params.id, req.body)
    if (!resultadoActualizado) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ resultado: resultadoActualizado })
  } catch (err) { next(err) }
}

// Elimina un resultado por ID
export const remove = async (req, res, next) => {
  try {
    const resultadoEliminado = await ResultadoModel.remove(req.params.id)
    if (!resultadoEliminado) return res.status(404).json({ error: 'Resultado no encontrado' })
    res.json({ mensaje: 'Resultado eliminado correctamente' })
  } catch (err) { next(err) }
}

// Crea múltiples resultados a partir de una convocatoria (carga masiva)
export const crearMasivo = async (req, res, next) => {
  try {
    const { convocatoria_id, atletas, ano_competitivo } = req.body
    const idsCreados = await ResultadoModel.createMasivoPorConvocatoria(convocatoria_id, atletas, ano_competitivo)
    if (!idsCreados) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    res.status(201).json({ mensaje: `${idsCreados.length} resultados creados`, ids: idsCreados })
  } catch (err) { next(err) }
}

// Lista resultados de una convocatoria específica
export const getByConvocatoria = async (req, res, next) => {
  try {
    const resultadosDeConvocatoria = await ResultadoModel.findByConvocatoria(req.params.convocatoriaId)
    if (resultadosDeConvocatoria === null) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    res.json({ resultados: resultadosDeConvocatoria })
  } catch (err) { next(err) }
}

// Elimina todos los resultados de una convocatoria
export const removeByConvocatoria = async (req, res, next) => {
  try {
    const cantidadEliminados = await ResultadoModel.removeByConvocatoria(req.params.convocatoriaId)
    if (cantidadEliminados === null) return res.status(404).json({ error: 'Convocatoria no encontrada' })
    res.json({ mensaje: `${cantidadEliminados} resultados eliminados` })
  } catch (err) { next(err) }
}