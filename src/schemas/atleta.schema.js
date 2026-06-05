import { z } from 'zod'

export const updatePerfilAtletaSchema = z.object({
  telefono:            z.string().regex(/^\d{10}$/).optional(),
  municipio:           z.string().max(100).optional(),
  lugar_entrenamiento: z.string().optional()
})

export const solicitudClubSchema = z.object({
  club_id: z.number().int().positive().optional(),
  tipo:    z.enum(['asociar', 'independiente'])
}).refine(
  data => !(data.tipo === 'asociar' && !data.club_id),
  { message: 'club_id es requerido cuando tipo es "asociar"' }
)

export const procesarSolicitudSchema = z.object({
  estado: z.enum(['aceptada', 'rechazada'])
})

export const updateClubAtletaSchema = z.object({
  club_id: z.number().int().positive().nullable()
})