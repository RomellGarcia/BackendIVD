import { z } from 'zod'

export const createClubSchema = z.object({
  nombre:      z.string().min(2, 'El nombre es requerido').max(100),
  direccion:   z.string().max(500).optional(),
  telefono:    z.string().max(20).optional(),
  email:       z.string().email('Email inválido').max(100).optional(),
  descripcion: z.string().optional(),
  lugar_entrenamiento: z.string().max(300).optional()
})

export const updateClubSchema = z.object({
  nombre:      z.string().min(2).max(100).optional(),
  direccion:   z.string().max(500).optional(),
  telefono:    z.string().max(20).optional(),
  email:       z.string().email('Email inválido').max(100).optional(),
  descripcion: z.string().optional(),
  estado:      z.enum(['activo', 'inactivo']).optional(),
  lugar_entrenamiento: z.string().max(300).optional(),
  entrenador_id: z.number().int().positive().nullable().optional()
})