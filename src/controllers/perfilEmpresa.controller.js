import * as PerfilModel from '../models/perfilEmpresa.model.js'

export const get = async (req, res, next) => {
  try {
    const perfil = await PerfilModel.find()
    if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' })
    res.json({ perfil })
  } catch (err) { next(err) }
}

export const update = async (req, res, next) => {
  try {
    await PerfilModel.update(req.body)
    const perfil = await PerfilModel.find()
    res.json({ mensaje: 'Perfil actualizado correctamente', perfil })
  } catch (err) { next(err) }
}

export const updateLogo = async (req, res, next) => {
  try {
    if (!req.files?.logo) {
      return res.status(400).json({ error: 'No se proporcionó imagen' })
    }
    const result = await PerfilModel.updateLogo(req.files.logo.tempFilePath)
    res.json({ mensaje: 'Logo actualizado correctamente', logo: result.logo })
  } catch (err) { next(err) }
}