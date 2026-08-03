import { supabase } from '../config/supabase.js'
import { findBySupabaseUid } from '../models/usuario.model.js'
import * as EntrenadorModel from '../models/entrenador.model.js'
import { pool } from '../config/db.js'

// Registro de usuario según rol (atleta, club, entrenador, admin)
export const register = async (req, res, next) => {
  try {
    const { email, password, rol } = req.body

    // Metadatos que se guardarán en Supabase Auth
    let userMetadata = {}

    if (rol === 'club') {
      // Club: solo datos básicos
      const { nombre, telefono, direccion, descripcion } = req.body
      userMetadata = { nombre, telefono, direccion, descripcion, rol: 'club' }
    } else {
      // Atleta o entrenador: datos personales completos
      const {
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, telefono, curp,
        estado_nacimiento, genero, municipio
      } = req.body
      userMetadata = {
        nombre, apellido_paterno, apellido_materno,
        fecha_nacimiento, telefono, curp,
        estado_nacimiento, genero, municipio,
        rol: rol || 'atleta'
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userMetadata }
    })

    if (error) return res.status(400).json({ error: error.message })
    console.log('[registro] rol recibido:', rol, '| user.id de Supabase:', data.user?.id)

    if (rol === 'entrenador' && data.user?.id) {
      const { anos_experiencia, especialidades, certificaciones } = req.body
      console.log('[registro-entrenador] datos profesionales recibidos:', { anos_experiencia, especialidades, certificaciones })
      try {
        // La fila de entrenadores la crea un trigger en la base de datos justo
        // después del signUp — puede tardar un instante, así que reintentamos
        // unas cuantas veces antes de darnos por vencidos.
        let usuario = null
        let entrenador = null
        for (let intento = 0; intento < 5 && !entrenador; intento++) {
          if (intento > 0) await new Promise((r) => setTimeout(r, 400))
          usuario = await findBySupabaseUid(data.user.id)
          entrenador = usuario ? await EntrenadorModel.findByUsuarioId(usuario.id) : null
          console.log(`[registro-entrenador] intento ${intento + 1}: usuario=${usuario?.id ?? 'null'} entrenador=${entrenador?.id ?? 'null'}`)
        }

        if (entrenador) {
          if (anos_experiencia !== undefined) {
            await EntrenadorModel.updatePerfil(entrenador.id, usuario.id, { anos_experiencia })
            console.log('[registro-entrenador] anos_experiencia guardado OK')
          }
          if (especialidades?.length) {
            await EntrenadorModel.updateEspecialidades(entrenador.id, especialidades)
            console.log('[registro-entrenador] especialidades guardadas OK:', especialidades)
          }
          if (certificaciones?.length) {
            await EntrenadorModel.updateCertificaciones(entrenador.id, certificaciones)
            console.log('[registro-entrenador] certificaciones guardadas OK:', certificaciones)
          }
        } else {
          console.error('[registro-entrenador] NO se encontró el registro de entrenador tras 5 intentos; no se guardó su información profesional')
        }
      } catch (errPerfil) {
        console.error('[registro-entrenador] ERROR al guardar información profesional:', errPerfil)
      }
    }


    res.status(201).json({
      mensaje: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
      user_id: data.user?.id
    })
  } catch (err) {
    next(err)
  }
}

// Inicio de sesión (email o CURP)
export const login = async (req, res, next) => {
  try {
    const { email, curp, password, rol } = req.body
    let emailToUse = email

    // Si se envía CURP en lugar de email, obtenemos el email desde la BD
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

      // Validar rol antes de intentar login (seguridad)
      if (rol && rows[0].rol !== mapRolFrontendToDB(rol)) {
        return res.status(401).json({ error: 'Credenciales incorrectas' })
      }

      emailToUse = rows[0].email
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password
    })

    if (error) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const usuario = await findBySupabaseUid(data.user.id)
    if (!usuario) {
      console.error('[login] Cuenta autenticada en Supabase pero sin fila en la tabla usuarios. supabase_uid:', data.user.id, 'email:', emailToUse)
      return res.status(401).json({ error: 'Tu cuenta no está completamente registrada en el sistema. Contacta al administrador.' })
    }

    // Validar que el rol seleccionado coincida con el rol real del usuario
    if (rol && usuario.rol !== mapRolFrontendToDB(rol)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    res.json({
      access_token: data.session.access_token,
      usuario
    })
  } catch (err) {
    next(err)
  }
}

// Mapeo de nombres de rol del frontend a los nombres en la BD
function mapRolFrontendToDB(rolFrontend) {
  const mapa = {
    'atleta': 'atleta',
    'club': 'club',
    'entrenador': 'entrenador',
    'administrador': 'admin',
  }
  return mapa[rolFrontend] || rolFrontend
}

// Cierre de sesión (invalida token en Supabase)
export const logout = async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) return res.status(500).json({ error: error.message })
    res.json({ mensaje: 'Sesión cerrada correctamente' })
  } catch (err) {
    next(err)
  }
}

// Obtiene los datos del usuario autenticado
export const me = async (req, res, next) => {
  try {
    const usuario = await findBySupabaseUid(req.user.id)
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado en la BD' })
    res.json({ usuario })
  } catch (err) {
    next(err)
  }
}

// Cambia la contraseña del usuario autenticado
export const changePassword = async (req, res, next) => {
  try {
    const { password } = req.body
    const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ mensaje: 'Contraseña actualizada correctamente' })
  } catch (err) {
    next(err)
  }
}