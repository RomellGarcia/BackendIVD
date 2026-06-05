import { z } from 'zod'

export const updatePerfilSchema = z.object({
  telefono:        z.string().max(20).optional(),
  anos_experiencia: z.number().int().min(0).optional(),
  certificaciones: z.array(z.string().min(1)).optional(),
  especialidades:  z.array(z.string().min(1)).optional()
})

export const solicitudClubSchema = z.object({
  club_id: z.number().int().positive('El club_id es requerido'),
  mensaje: z.string().max(500).optional()
})