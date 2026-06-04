import { supabase } from '../config/supabase.js'

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Token inválido o expirado' })

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}