import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  nombre: z.string().min(2, 'El nombre es requerido'),
  apellido_paterno: z.string().min(2, 'El apellido paterno es requerido'),
  apellido_materno: z.string().optional(),
  rol_id: z.number().int().positive()
})

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida')
})