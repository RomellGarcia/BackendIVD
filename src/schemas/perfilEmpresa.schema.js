import { z } from 'zod'

const redSchema = z.object({
  plataforma: z.enum(['facebook', 'instagram', 'twitter', 'youtube', 'tiktok']),
  url: z.string().url('URL inválida').optional().or(z.literal(''))
})

export const updatePerfilSchema = z.object({
  nombre_empresa:  z.string().min(2).max(150).optional(),
  eslogan:         z.string().max(200).optional(),
  direccion:       z.string().max(300).optional(),
  correo:          z.string().email('Correo inválido'),
  telefono:        z.string().regex(/^\d{10}$/, 'El teléfono debe tener 10 dígitos'),
  mostrar_whatsapp: z.boolean().optional().default(true),
  redes:           z.array(redSchema).optional()
})