import * as PerfilModel from '../models/perfilEmpresa.model.js'

// Obtiene el perfil de la empresa
export const get = async (req, res, next) => {
  try {
    const perfil = await PerfilModel.find()
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' })
    res.json({ perfil })
  } catch (err) { next(err) }
}

// Actualiza los datos del perfil de la empresa
export const update = async (req, res, next) => {
  try {
    await PerfilModel.update(req.body)
    const perfilActualizado = await PerfilModel.find()
    res.json({ mensaje: 'Perfil actualizado correctamente', perfil: perfilActualizado })
  } catch (err) { next(err) }
}