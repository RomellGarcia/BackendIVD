import * as ContenidoModel from '../models/contenidoEstatico.model.js'

// Obtiene contenido estático por tipo (mision, vision, politica, terminos)
export const getByTipo = async (req, res, next) => {
  try {
    const { tipo } = req.params
    if (!ContenidoModel.validarTipo(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Válidos: mision, vision, politica, terminos` })
    }
    const contenido = await ContenidoModel.findByTipo(tipo)
    if (!contenido) return res.status(404).json({ error: 'Contenido no encontrado' })
    res.json({ contenido })
  } catch (err) { next(err) }
}

// Actualiza o crea contenido estático (tipo desde params, datos desde body)
export const upsert = async (req, res, next) => {
  try {
    const { tipo } = req.params
    if (!ContenidoModel.validarTipo(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Válidos: mision, vision, politica, terminos` })
    }
    const contenido = await ContenidoModel.upsert(tipo, req.body)
    res.json({ mensaje: 'Contenido actualizado correctamente', contenido })
  } catch (err) { next(err) }
}