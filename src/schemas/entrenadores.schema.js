import { z } from 'zod'

export const updateSolicitudSchema = z.object({
  estado: z.enum(['pendiente', 'aceptada', 'rechazada'])
})


export const updateAdminEntrenadorSchema = z.object({
  nombre:              z.string().min(1).max(100).optional(),
  apellido_paterno:    z.string().min(1).max(100).optional(),
  apellido_materno:    z.string().max(100).optional(),
  email:               z.string().email().optional(),
  telefono:            z.string().regex(/^\d{10}$/).optional(),
  curp:                z.string().length(18).optional(),
  fecha_nacimiento:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado_nacimiento:   z.string().max(100).optional(),
  genero:              z.enum(['masculino', 'femenino', 'otro']).optional(),
  anos_experiencia:    z.number().int().min(0).optional()
})

export const updateClubEntrenadorSchema = z.object({
  club_id: z.number().int().positive().nullable()
})