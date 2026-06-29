import { supabase } from '../config/supabase.js'
import { findBySupabaseUid } from '../models/usuario.model.js'
import { pool } from '../config/db.js'

export const register = async (req, res, next) => {
  try {
    const { email, password, rol } = req.body

    let metadata = {}

    if (rol === 'club') {
      // Club: solo necesita nombre, telefono y datos básicos
      const { nombre, telefono, direccion, descripcion } = req.body
      metadata = { nombre, telefono, direccion, descripcion, rol: 'club' }
    } else {
      // Atleta o Entrenador: datos personales completos
      const {
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, telefono, curp,
        estado_nacimiento, genero, municipio
      } = req.body
      metadata = {
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, telefono, curp,
        estado_nacimiento, genero, municipio,
        rol: rol || 'atleta'
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })

    if (error) return res.status(400).json({ error: error.message })

    res.status(201).json({
      mensaje: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
      user_id: data.user?.id
    })
  } catch (err) {
    next(err)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, curp, password, rol } = req.body
    let emailToUse = email

    // Si viene CURP en lugar de email
    if (curp && !email) {
      const { rows } = await pool.query(
        `SELECT u.email, r.nombre AS rol
         FROM usuarios u
         JOIN roles r ON u.rol_id = r.id
         WHERE u.curp = $1`,
        [curp.toUpperCase()]
      )
      if (!rows[0]) {
        return res.status(401).json({ error: 'La CURP ingresada no existe' })
      }

      // Validar rol antes de intentar login
      if (rol && rows[0].rol !== mapRol(rol)) {
        // DESPUÉS:
        return res.status(401).json({
          error: 'Credenciales incorrectas'
        })
      }

      emailToUse = rows[0].email
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    })

    if (error) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const usuario = await findBySupabaseUid(data.user.id)

    // Validar que el rol seleccionado coincida con el rol real
    if (rol && usuario.rol !== mapRol(rol)) {
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      })
    }

    res.json({
      access_token: data.session.access_token,
      usuario
    })
  } catch (err) {
    next(err)
  }
}

function mapRol(rolFrontend) {
  const mapa = {
    'atleta': 'atleta',
    'club': 'club',
    'entrenador': 'entrenador',
    'administrador': 'admin',
  }
  return mapa[rolFrontend] || rolFrontend
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
    const usuario = await findBySupabaseUid(req.user.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado en la BD' })
    res.json({ usuario })
  } catch (err) {
    next(err)
  }
}