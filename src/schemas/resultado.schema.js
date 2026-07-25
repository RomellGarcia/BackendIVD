import { z } from 'zod'

const pruebaSchema = z.object({
  nombre: z.string().min(1),
  marca:  z.string().min(1),
  unidad: z.string().optional()
})

export const createResultadoSchema = z.object({
  evento_id:       z.number().int().positive(),
  atleta_id:       z.number().int().positive(),
  entrenador_id:   z.number().int().positive().optional(),
  categoria_id:    z.number().int().positive().optional(),
  genero_id:       z.number().int().positive().optional(),
  disciplina_id:   z.number().int().positive().optional(),
  ano_competitivo: z.number().int().min(2000).max(2100).optional(),
  pruebas:         z.array(pruebaSchema).optional().default([])
})

export const updateResultadoSchema = z.object({
  evento_id:       z.number().int().positive().optional(),
  atleta_id:       z.number().int().positive().optional(),
  entrenador_id:   z.number().int().positive().nullable().optional(),
  categoria_id:    z.number().int().positive().nullable().optional(),
  genero_id:       z.number().int().positive().nullable().optional(),
  disciplina_id:   z.number().int().positive().nullable().optional(),
  ano_competitivo: z.number().int().min(2000).max(2100).optional(),
  pruebas:         z.array(pruebaSchema).optional()
})

export const crearMasivoResultadoSchema = z.object({
  convocatoria_id: z.number().int().positive(),
  ano_competitivo: z.number().int().min(2000).max(2100).optional(),
  atletas: z.array(
    z.object({
      atleta_id: z.number().int().positive(),
      pruebas: z.array(pruebaSchema).min(1),
    })
  ).min(1, 'Se requiere al menos un atleta'),
})