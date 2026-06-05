// Genera el objeto de paginación para queries con LIMIT/OFFSET
export const paginate = (page = 1, pageSize = 20) => {
  const limit  = Math.min(parseInt(pageSize), 100) // máximo 100 por página
  const offset = (Math.max(parseInt(page), 1) - 1) * limit
  return { limit, offset }
}

// Construye la respuesta paginada
export const paginatedResponse = ({ data, total, page, pageSize }) => ({
  data,
  pagination: {
    total,
    page:       parseInt(page),
    pageSize:   parseInt(pageSize),
    totalPages: Math.ceil(total / pageSize)
  }
})