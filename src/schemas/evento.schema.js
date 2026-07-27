import { z } from 'zod'

const convocatoriaSchema = z.object({
  disciplina_id: z.number().int().positive(),
  categoria_id:  z.number().int().positive(),
  genero_id:     z.number().int().positive()
})

export const createEventoSchema = z.object({
  titulo:       z.string().min(2).max(200),
  fecha:        z.string().date('Fecha inválida'),
  hora:         z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  lugar:        z.string().min(2).max(200),
  descripcion:  z.string().optional(),
  fecha_cierre: z.string().datetime({ offset: true }).optional(),
  convocatorias: z.array(convocatoriaSchema).min(1, 'Se requiere al menos una convocatoria')
})

export const addConvocatoriaSchema = convocatoriaSchema

export const updateFechaCierreSchema = z.object({
  fecha_cierre: z.string().datetime({ offset: true })
})

export const inscripcionSchema = z.object({
  convocatoria_id: z.number().int().positive()
})

export const updateConvocatoriaSchema = z.object({
  disciplina_id: z.number().int().positive().optional(),
  categoria_id:  z.number().int().positive().optional(),
  genero_id:     z.number().int().positive().optional(),
}).refine(
  (data) => data.disciplina_id || data.categoria_id || data.genero_id,
  { message: 'Debes enviar al menos un campo para actualizar' }
)