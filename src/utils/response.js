// Respuesta exitosa
export const ok = (res, data = {}, status = 200) => {
  return res.status(status).json({ ok: true, ...data })
}

// Respuesta de error
export const error = (res, message, status = 400) => {
  return res.status(status).json({ ok: false, error: message })
}

// Respuesta 404
export const notFound = (res, message = 'Recurso no encontrado') => {
  return res.status(404).json({ ok: false, error: message })
}