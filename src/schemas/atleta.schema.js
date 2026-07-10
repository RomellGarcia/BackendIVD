import { z } from 'zod'

export const updatePerfilAtletaSchema = z.object({
  nombre:              z.string().min(1).max(100).optional(),
  apellido_paterno:    z.string().min(1).max(100).optional(),
  apellido_materno:    z.string().max(100).optional(),
  email:               z.string().email().optional(),
  telefono:            z.string().regex(/^\d{10}$/).optional(),
  genero:              z.enum(['masculino', 'femenino', 'otro']).optional(),
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

export const updateAdminAtletaSchema = z.object({
  nombre:              z.string().min(1).max(100).optional(),
  apellido_paterno:    z.string().min(1).max(100).optional(),
  apellido_materno:    z.string().max(100).optional(),
  email:               z.string().email().optional(),
  telefono:            z.string().regex(/^\d{10}$/).optional(),
  curp:                z.string().length(18).optional(),
  fecha_nacimiento:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado_nacimiento:   z.string().max(100).optional(),
  genero:              z.enum(['masculino', 'femenino', 'otro']).optional(),
  municipio:           z.string().max(100).optional(),
  lugar_entrenamiento: z.string().optional()
})