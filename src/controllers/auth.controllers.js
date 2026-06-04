import { supabase } from '../config/supabase.js'
import { findBySupabaseUid } from '../models/usuario.model.js'

export const register = async (req, res, next) => {
  try {
    const { email, password, nombre, apellido_paterno, apellido_materno, rol_id } = req.body

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, apellido_paterno, apellido_materno, rol_id }
        // user_metadata disponible en el trigger para insertar en `usuarios`
      }
    })

    if (error) return res.status(400).json({ error: error.message })

    res.status(201).json({
      mensaje: 'Usuario registrado. Revisa tu correo para confirmar tu cuenta.',
      user_id: data.user?.id
    })
  } catch (err) {
    next(err)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const usuario = await findBySupabaseUid(data.user.id)

    res.json({
      access_token: data.session.access_token,
      usuario
    })
  } catch (err) {
    next(err)
  }
}

export const logout = async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ mensaje: 'Sesión cerrada correctamente' })
  } catch (err) {
    next(err)
  }
}

export const me = async (req, res, next) => {
  try {
    // req.user viene del middleware requireAuth (ya validado)
    const usuario = await findBySupabaseUid(req.user.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado en la BD' })
    res.json({ usuario })
  } catch (err) {
    next(err)
  }
}