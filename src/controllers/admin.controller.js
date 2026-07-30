import { supabase } from '../config/supabase.js'
import { pool } from '../config/db.js'

// Lista todos los usuarios con rol admin
export const getAll = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.email
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE r.nombre = 'admin'
       ORDER BY u.id ASC`
    )
    res.json({ admins: rows })
  } catch (err) {
    next(err)
  }
}

// Crea un nuevo administrador (solo correo y contraseña)
export const crear = async (req, res, next) => {
  try {
    const { email, password } = req.body

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: 'Administrador', rol: 'admin' }
    })

    if (error) return res.status(400).json({ error: error.message })

    res.status(201).json({
      mensaje: 'Administrador creado correctamente',
      user_id: data.user?.id
    })
  } catch (err) {
    next(err)
  }
}