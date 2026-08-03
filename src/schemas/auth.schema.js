import { z } from 'zod'

const baseSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  nombre:   z.string().min(2),
  rol:      z.enum(['atleta', 'entrenador', 'club']).default('atleta'),
})

const personalSchema = baseSchema.extend({
  rol:               z.enum(['atleta', 'entrenador']),
  apellido_paterno:  z.string().min(2),
  apellido_materno:  z.string().optional(),
  fecha_nacimiento:  z.string().date('Fecha inválida'),
  telefono:          z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos'),
  curp:              z.string().regex(/^[A-Za-z0-9]{18}$/, 'CURP inválida'),
  estado_nacimiento: z.string().optional(),
  genero:            z.enum(['masculino', 'femenino']),
  municipio:         z.string().optional(),
})

const clubSchema = baseSchema.extend({
  rol:         z.literal('club'),
  telefono:    z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos').optional(),
  direccion:   z.string().optional(),
  descripcion: z.string().optional(),
})

export const registerSchema = z.discriminatedUnion('rol', [
  personalSchema.extend({ rol: z.literal('atleta') }),
  personalSchema.extend({
    rol: z.literal('entrenador'),
    especialidades: z.array(z.string()).optional(),
    certificaciones: z.array(z.string()).optional(),
    anos_experiencia: z.coerce.number().int().min(0).optional(),
  }),
  clubSchema,
])

export const crearAdminSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const changePasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const loginSchema = z.object({
  email:    z.string().email().optional(),
  curp:     z.string().regex(/^[A-Za-z0-9]{18}$/, 'CURP inválida').optional(),
  password: z.string().min(1),
  rol:      z.enum(['atleta', 'club', 'entrenador', 'administrador']).optional(),
}).refine(
  data => data.email || data.curp,
  { message: 'Se requiere email o CURP' }
)