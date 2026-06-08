// src/schemas/auth.schema.js
import { z } from 'zod'

export const registerSchema = z.object({
  email:             z.string().email('Email inválido'),
  password:          z.string().min(8, 'Mínimo 8 caracteres'),
  nombre:            z.string().min(2),
  apellido_paterno:  z.string().min(2),
  apellido_materno:  z.string().optional(),
  fecha_nacimiento:  z.string().date('Fecha inválida'),
  telefono:          z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos'),
  curp:              z.string().regex(/^[A-Za-z0-9]{18}$/, 'CURP inválida'),
  estado_nacimiento: z.string().optional(),
  rol:               z.enum(['atleta', 'entrenador']).default('atleta'),
  genero:            z.enum(['masculino', 'femenino'])
})

export const loginSchema = z.object({
  email:    z.string().email().optional(),
  curp:     z.string().regex(/^[A-Za-z0-9]{18}$/).optional(),
  password: z.string().min(1)
}).refine(
  data => data.email || data.curp,
  { message: 'Se requiere email o CURP' }
)