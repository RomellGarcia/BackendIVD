import { z } from 'zod'

export const contenidoSchema = z.object({
  titulo:   z.string().min(1).max(100),
  contenido: z.string().min(1)
})