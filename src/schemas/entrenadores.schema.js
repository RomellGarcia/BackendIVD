import { z } from 'zod'

export const updateSolicitudSchema = z.object({
  estado: z.enum(['pendiente', 'aceptada', 'rechazada'])
})