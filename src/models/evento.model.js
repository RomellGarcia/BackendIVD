import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'
import {
  sendConvocatoriaCanceladaEmail,
  sendEventoCanceladoEmail,
  sendConvocatoriaCanceladaClubEmail,
  sendEventoCanceladoClubEmail,
  sendConvocatoriaFinalizadaEmail,
  sendEventoFinalizadoEmail,
  sendConvocatoriaFinalizadaClubEmail,
  sendEventoFinalizadoClubEmail
} from '../services/email.service.js'

// Lista eventos activos (opcionalmente todos si admin pide todos=true)
export const findAll = async (limit, todos = false) => {
  const query = `
    SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.finalizado, e.imagen_url, e.created_at,
      e.documento_convocatoria_url AS "documentoConvocatoria",
      e.documento_deslinde_url    AS "documentoDeslinde",
      COALESCE(
        JSON_AGG(
          jsonb_build_object(
            'id', c.id,
            'disciplina', d.nombre,
            'categoria', cat.nombre,
            'edadMin', cat.edad_min,
            'edadMax', cat.edad_max,
            'genero', g.nombre,
            'estado', c.estado
          )
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS convocatorias
    FROM eventos e
    LEFT JOIN convocatorias c ON c.evento_id = e.id
    LEFT JOIN disciplinas d   ON c.disciplina_id = d.id
    LEFT JOIN categorias cat  ON c.categoria_id = cat.id
    LEFT JOIN generos g       ON c.genero_id = g.id
    ${todos ? '' : 'WHERE e.estado = true'}
    GROUP BY e.id
    ORDER BY e.created_at DESC
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `
  const { rows } = await pool.query(query)
  return rows
}

// Obtiene un evento por ID con sus convocatorias
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.finalizado, e.imagen_url, e.created_at,
      e.documento_convocatoria_url AS "documentoConvocatoria",
      e.documento_deslinde_url    AS "documentoDeslinde",
      COALESCE(
        JSON_AGG(
          jsonb_build_object(
            'id', c.id,
            'disciplina_id', c.disciplina_id,
            'disciplina', d.nombre,
            'categoria_id', c.categoria_id,
            'categoria', cat.nombre,
            'edadMin', cat.edad_min,
            'edadMax', cat.edad_max,
            'genero_id', c.genero_id,
            'genero', g.nombre,
            'estado', c.estado
          )
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) AS convocatorias
     FROM eventos e
     LEFT JOIN convocatorias c ON c.evento_id = e.id
     LEFT JOIN disciplinas d   ON c.disciplina_id = d.id
     LEFT JOIN categorias cat  ON c.categoria_id = cat.id
     LEFT JOIN generos g       ON c.genero_id = g.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [id]
  )
  return rows[0] || null
}

// Crea evento con sus convocatorias (transacción)
export const create = async ({
  titulo, fecha, hora, lugar, descripcion, fecha_cierre, imagen_url,
  documento_convocatoria_url, documento_deslinde_url, convocatorias
}) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: eventoRows } = await client.query(
      `INSERT INTO eventos
        (titulo, fecha, hora, lugar, descripcion, fecha_cierre, imagen_url,
         documento_convocatoria_url, documento_deslinde_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titulo, fecha, hora, lugar, descripcion || null, fecha_cierre, imagen_url || null,
        documento_convocatoria_url || null, documento_deslinde_url || null
      ]
    )
    const evento = eventoRows[0]

    for (const conv of convocatorias) {
      await client.query(
        `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id)
         VALUES ($1, $2, $3, $4)`,
        [evento.id, conv.disciplina_id, conv.categoria_id, conv.genero_id]
      )
    }

    await client.query('COMMIT')
    return await findById(evento.id)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Actualiza solo la fecha de cierre del evento
export const updateFechaCierre = async (id, fecha_cierre) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET fecha_cierre = $1 WHERE id = $2 RETURNING *`,
    [fecha_cierre, id]
  )
  return rows[0] || null
}

// Actualiza datos generales del evento
export const update = async (id, fields) => {
  const {
    titulo, fecha, hora, lugar, descripcion, fecha_cierre,
    imagen_url, imagen_public_id,
    documento_convocatoria_url, documento_convocatoria_public_id,
    documento_deslinde_url, documento_deslinde_public_id
  } = fields

  const { rows } = await pool.query(
    `UPDATE eventos SET
       titulo                            = COALESCE($1, titulo),
       fecha                             = COALESCE($2, fecha),
       hora                              = COALESCE($3, hora),
       lugar                             = COALESCE($4, lugar),
       descripcion                       = COALESCE($5, descripcion),
       fecha_cierre                      = COALESCE($6, fecha_cierre),
       imagen_url                        = COALESCE($7, imagen_url),
       imagen_public_id                  = COALESCE($8, imagen_public_id),
       documento_convocatoria_url        = COALESCE($9, documento_convocatoria_url),
       documento_convocatoria_public_id  = COALESCE($10, documento_convocatoria_public_id),
       documento_deslinde_url            = COALESCE($11, documento_deslinde_url),
       documento_deslinde_public_id      = COALESCE($12, documento_deslinde_public_id)
     WHERE id = $13
     RETURNING *`,
    [
      titulo ?? null, fecha ?? null, hora ?? null, lugar ?? null, descripcion ?? null, fecha_cierre ?? null,
      imagen_url ?? null, imagen_public_id ?? null,
      documento_convocatoria_url ?? null, documento_convocatoria_public_id ?? null,
      documento_deslinde_url ?? null, documento_deslinde_public_id ?? null,
      id
    ]
  )
  if (!rows[0]) return null
  return findById(id)
}

// Activa o desactiva un evento
export const toggleEstado = async (id, estado) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET estado = $1 WHERE id = $2 RETURNING *`,
    [estado, id]
  )
  return rows[0] || null
}

// Lista convocatorias de un evento con datos de su documento de resultados
export const findConvocatoriasByEvento = async (eventoId) => {
  const { rows } = await pool.query(
    `SELECT
      c.id, c.estado,
      d.nombre AS disciplina, cat.nombre AS categoria, g.nombre AS genero,
      cat.edad_min AS "edadMin", cat.edad_max AS "edadMax",
      c.documento_resultado_url        AS "documentoResultado",
      c.documento_resultado_public_id  AS "documentoResultadoPublicId"
     FROM convocatorias c
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     WHERE c.evento_id = $1
     ORDER BY d.nombre ASC`,
    [eventoId]
  )
  return rows
}

// Obtiene una convocatoria por ID
export const findConvocatoriaById = async (convocatoriaId) => {
  const { rows } = await pool.query(`SELECT * FROM convocatorias WHERE id = $1`, [convocatoriaId])
  return rows[0] || null
}

// Guarda o reemplaza el documento de resultados de una convocatoria
export const subirDocumentoResultado = async (convocatoriaId, { url, publicId }) => {
  const { rows } = await pool.query(
    `UPDATE convocatorias
     SET documento_resultado_url = $1, documento_resultado_public_id = $2
     WHERE id = $3
     RETURNING *`,
    [url, publicId, convocatoriaId]
  )
  return rows[0] || null
}

// Elimina el documento de resultados (devuelve el public_id para borrar de Cloudinary)
export const eliminarDocumentoResultado = async (convocatoriaId) => {
  const { rows } = await pool.query(
    `SELECT documento_resultado_public_id FROM convocatorias WHERE id = $1`,
    [convocatoriaId]
  )
  const publicId = rows[0]?.documento_resultado_public_id || null
  await pool.query(
    `UPDATE convocatorias SET documento_resultado_url = NULL, documento_resultado_public_id = NULL WHERE id = $1`,
    [convocatoriaId]
  )
  return publicId
}

// Elimina una convocatoria, notifica a inscritos y sus clubes
export const removeConvocatoria = async (convocatoriaId) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: convRows } = await client.query(
      `SELECT c.id, e.titulo AS evento_titulo, d.nombre AS disciplina, cat.nombre AS categoria
       FROM convocatorias c
       JOIN eventos e      ON c.evento_id = e.id
       JOIN disciplinas d  ON c.disciplina_id = d.id
       JOIN categorias cat ON c.categoria_id = cat.id
       WHERE c.id = $1`,
      [convocatoriaId]
    )
    const convocatoria = convRows[0]
    if (!convocatoria) { await client.query('ROLLBACK'); return { error: 'Convocatoria no encontrada' } }

    // Obtener inscritos con sus datos de contacto y club
    const { rows: inscritos } = await client.query(
      `SELECT a.usuario_id, u.email, u.nombre,
              cl.id AS club_id, cl.email AS club_email, cl.nombre AS club_nombre
       FROM inscripciones i
       JOIN atletas a       ON i.atleta_id = a.id
       JOIN usuarios u      ON a.usuario_id = u.id
       LEFT JOIN clubes cl  ON a.club_id = cl.id
       WHERE i.convocatoria_id = $1`,
      [convocatoriaId]
    )

    // Eliminar inscripciones y convocatoria
    await client.query(`DELETE FROM inscripciones WHERE convocatoria_id = $1`, [convocatoriaId])
    await client.query(`DELETE FROM convocatorias WHERE id = $1`, [convocatoriaId])

    await client.query('COMMIT')

    // Notificaciones y correos
    if (inscritos.length > 0) {
      const mensaje = `Tu inscripción a "${convocatoria.disciplina} - ${convocatoria.categoria}" del evento "${convocatoria.evento_titulo}" fue cancelada porque esa convocatoria fue eliminada.`

      await NotificacionModel.crearParaVarios(inscritos.map(i => i.usuario_id), mensaje)

      const clubesUnicos = [...new Map(
        inscritos.filter(i => i.club_id).map(i => [i.club_id, i])
      ).values()]

      for (const club of clubesUnicos) {
        const mensajeClub = `La convocatoria "${convocatoria.disciplina} - ${convocatoria.categoria}" del evento "${convocatoria.evento_titulo}" fue cancelada. Uno o más de tus atletas fueron dados de baja automáticamente.`
        await NotificacionModel.crearParaClub(club.club_id, mensajeClub)
      }

      for (const atleta of inscritos) {
        sendConvocatoriaCanceladaEmail({
          to: atleta.email,
          nombre: atleta.nombre,
          disciplina: convocatoria.disciplina,
          categoria: convocatoria.categoria,
          eventoTitulo: convocatoria.evento_titulo,
        }).catch(err => console.error('Error al enviar correo a atleta:', err.message))
      }
      for (const club of clubesUnicos) {
        const atletasDelClub = inscritos.filter(i => i.club_id === club.club_id).map(i => i.nombre)
        sendConvocatoriaCanceladaClubEmail({
          to: club.club_email,
          clubNombre: club.club_nombre,
          disciplina: convocatoria.disciplina,
          categoria: convocatoria.categoria,
          eventoTitulo: convocatoria.evento_titulo,
          atletas: atletasDelClub,
        }).catch(err => console.error('Error al enviar correo a club:', err.message))
      }
    }

    return { ok: true, atletasAfectados: inscritos.length }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Elimina evento completo, notifica a inscritos y devuelve IDs de archivos para borrar de Cloudinary
export const remove = async (id) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: eventoRows } = await client.query(
      `SELECT titulo, imagen_public_id, documento_convocatoria_public_id, documento_deslinde_public_id
       FROM eventos WHERE id = $1`,
      [id]
    )
    const evento = eventoRows[0]
    if (!evento) { await client.query('ROLLBACK'); return { error: 'Evento no encontrado' } }

    const { rows: inscritos } = await client.query(
      `SELECT DISTINCT a.usuario_id, u.email, u.nombre,
              cl.id AS club_id, cl.email AS club_email, cl.nombre AS club_nombre
       FROM inscripciones i
       JOIN convocatorias c ON i.convocatoria_id = c.id
       JOIN atletas a       ON i.atleta_id = a.id
       JOIN usuarios u      ON a.usuario_id = u.id
       LEFT JOIN clubes cl  ON a.club_id = cl.id
       WHERE c.evento_id = $1`,
      [id]
    )

    // Eliminar inscripciones, convocatorias y evento
    await client.query(
      `DELETE FROM inscripciones WHERE convocatoria_id IN (SELECT id FROM convocatorias WHERE evento_id = $1)`,
      [id]
    )
    await client.query(`DELETE FROM convocatorias WHERE evento_id = $1`, [id])
    await client.query(`DELETE FROM eventos WHERE id = $1`, [id])

    await client.query('COMMIT')

    // Notificaciones y correos
    if (inscritos.length > 0) {
      const mensaje = `Tu inscripción al evento "${evento.titulo}" fue cancelada porque el evento fue eliminado.`
      await NotificacionModel.crearParaVarios(inscritos.map(i => i.usuario_id), mensaje)

      const clubesUnicos = [...new Map(
        inscritos.filter(i => i.club_id).map(i => [i.club_id, i])
      ).values()]

      for (const club of clubesUnicos) {
        const mensajeClub = `El evento "${evento.titulo}" fue cancelado. Uno o más de tus atletas fueron dados de baja automáticamente.`
        await NotificacionModel.crearParaClub(club.club_id, mensajeClub)
      }

      for (const atleta of inscritos) {
        sendEventoCanceladoEmail({
          to: atleta.email,
          nombre: atleta.nombre,
          eventoTitulo: evento.titulo,
        }).catch(err => console.error('Error al enviar correo a atleta:', err.message))
      }
      for (const club of clubesUnicos) {
        const atletasDelClub = inscritos.filter(i => i.club_id === club.club_id).map(i => i.nombre)
        sendEventoCanceladoClubEmail({
          to: club.club_email,
          clubNombre: club.club_nombre,
          eventoTitulo: evento.titulo,
          atletas: atletasDelClub,
        }).catch(err => console.error('Error al enviar correo a club:', err.message))
      }
    }

    return {
      ok: true,
      atletasAfectados: inscritos.length,
      archivosCloudinary: {
        imagen: evento.imagen_public_id,
        documentoConvocatoria: evento.documento_convocatoria_public_id,
        documentoDeslinde: evento.documento_deslinde_public_id,
      }
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Verifica si ya existe una convocatoria duplicada en el mismo evento
const existeConvocatoriaDuplicada = async (evento_id, disciplina_id, categoria_id, genero_id, excluirId = null) => {
  const params = [evento_id, disciplina_id, categoria_id, genero_id]
  let query = `SELECT id FROM convocatorias WHERE evento_id = $1 AND disciplina_id = $2 AND categoria_id = $3 AND genero_id = $4`
  if (excluirId) {
    params.push(excluirId)
    query += ` AND id != $5`
  }
  const { rows } = await pool.query(query, params)
  return rows.length > 0
}

// Agrega una nueva convocatoria a un evento existente
export const addConvocatoria = async (eventoId, { disciplina_id, categoria_id, genero_id, hora }) => {
  if (await existeConvocatoriaDuplicada(eventoId, disciplina_id, categoria_id, genero_id)) {
    return { error: 'Ya existe una convocatoria con esa disciplina, categoría y género para este evento.' }
  }
  const { rows } = await pool.query(
    `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id, hora)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [eventoId, disciplina_id, categoria_id, genero_id, hora || null]
  )
  return rows[0]
}

// Actualiza los datos de una convocatoria existente
export const updateConvocatoria = async (convocatoriaId, { disciplina_id, categoria_id, genero_id, hora }) => {
  const { rows: actual } = await pool.query(`SELECT evento_id FROM convocatorias WHERE id = $1`, [convocatoriaId])
  if (!actual[0]) return null

  if (disciplina_id && categoria_id && genero_id) {
    if (await existeConvocatoriaDuplicada(actual[0].evento_id, disciplina_id, categoria_id, genero_id, convocatoriaId)) {
      return { error: 'Ya existe otra convocatoria con esa disciplina, categoría y género para este evento.' }
    }
  }

  const { rows } = await pool.query(
    `UPDATE convocatorias SET
       disciplina_id = COALESCE($1, disciplina_id),
       categoria_id  = COALESCE($2, categoria_id),
       genero_id     = COALESCE($3, genero_id),
       hora          = COALESCE($4, hora)
     WHERE id = $5
     RETURNING id`,
    [disciplina_id ?? null, categoria_id ?? null, genero_id ?? null, hora ?? null, convocatoriaId]
  )
  if (!rows[0]) return null

  const { rows: joined } = await pool.query(
    `SELECT
      c.id,
      c.disciplina_id, d.nombre AS disciplina,
      c.categoria_id,  cat.nombre AS categoria,
      cat.edad_min AS "edadMin", cat.edad_max AS "edadMax",
      c.genero_id,     g.nombre AS genero,
      c.estado, c.hora
     FROM convocatorias c
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     WHERE c.id = $1`,
    [convocatoriaId]
  )
  return joined[0]
}

// Abre o cierra una convocatoria, si es la última abierta, finaliza el evento.
export const toggleEstadoConvocatoria = async (convocatoriaId, estado) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `UPDATE convocatorias SET estado = $1 WHERE id = $2 RETURNING *`,
      [estado, convocatoriaId]
    )
    const convocatoria = rows[0]
    if (!convocatoria) { await client.query('ROLLBACK'); return null }

    let datosParaEmail = null

    if (estado === false) {
      const { rows: abiertas } = await client.query(
        `SELECT id FROM convocatorias WHERE evento_id = $1 AND estado = true`,
        [convocatoria.evento_id]
      )
      if (abiertas.length === 0) {
        await client.query(`UPDATE eventos SET finalizado = true WHERE id = $1`, [convocatoria.evento_id])
      }

      // Notificar a inscritos que la convocatoria finalizó
      const { rows: datos } = await client.query(
        `SELECT e.titulo AS evento_titulo, d.nombre AS disciplina, cat.nombre AS categoria
         FROM eventos e
         JOIN disciplinas d  ON d.id = $1
         JOIN categorias cat ON cat.id = $2
         WHERE e.id = $3`,
        [convocatoria.disciplina_id, convocatoria.categoria_id, convocatoria.evento_id]
      )
      const { rows: inscritos } = await client.query(
        `SELECT DISTINCT u.id AS usuario_id, u.nombre, u.email,
                cl.id AS club_id, cl.email AS club_email, cl.nombre AS club_nombre
         FROM inscripciones i
         JOIN atletas a       ON i.atleta_id = a.id
         JOIN usuarios u      ON a.usuario_id = u.id
         LEFT JOIN clubes cl  ON a.club_id = cl.id
         WHERE i.convocatoria_id = $1`,
        [convocatoriaId]
      )
      if (inscritos.length > 0 && datos[0]) {
        const { evento_titulo, disciplina, categoria } = datos[0]
        const mensaje = `La convocatoria "${disciplina} - ${categoria}" del evento "${evento_titulo}" ha finalizado.`
        await NotificacionModel.crearParaVarios(inscritos.map((i) => i.usuario_id), mensaje)

        const clubesUnicos = [...new Map(
          inscritos.filter((i) => i.club_id).map((i) => [i.club_id, i])
        ).values()]
        if (clubesUnicos.length > 0) {
          const mensajeClub = `La convocatoria "${disciplina} - ${categoria}" del evento "${evento_titulo}" ha finalizado.`
          for (const club of clubesUnicos) {
            await NotificacionModel.crearParaClub(club.club_id, mensajeClub)
          }
        }

        datosParaEmail = { evento_titulo, disciplina, categoria, inscritos, clubesUnicos }
      }
    }

    await client.query('COMMIT')

    if (datosParaEmail) {
      const { evento_titulo, disciplina, categoria, inscritos, clubesUnicos } = datosParaEmail
      for (const u of inscritos) {
        await sendConvocatoriaFinalizadaEmail({
          to: u.email, nombre: u.nombre, disciplina, categoria, eventoTitulo: evento_titulo,
        }).catch((err) => console.error(`No se pudo enviar el correo de convocatoria finalizada a ${u.email}:`, err))
      }
      for (const club of clubesUnicos) {
        const atletasDelClub = inscritos.filter((i) => i.club_id === club.club_id).map((i) => i.nombre)
        await sendConvocatoriaFinalizadaClubEmail({
          to: club.club_email, clubNombre: club.club_nombre, disciplina, categoria, eventoTitulo: evento_titulo,
          atletas: atletasDelClub,
        }).catch((err) => console.error(`No se pudo enviar el correo de convocatoria finalizada al club ${club.club_email}:`, err))
      }
    }

    return convocatoria
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Finaliza o reabre un evento manualmente, al finalizar cierra todas sus convocatorias.
export const toggleFinalizadoEvento = async (eventoId, finalizado) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows } = await client.query(
      `UPDATE eventos SET finalizado = $1 WHERE id = $2 RETURNING *`,
      [finalizado, eventoId]
    )
    if (!rows[0]) { await client.query('ROLLBACK'); return null }

    let inscritosParaEmail = null
    let clubesParaEmail = null

    if (finalizado) {
      await client.query(`UPDATE convocatorias SET estado = false WHERE evento_id = $1`, [eventoId])

      const { rows: inscritos } = await client.query(
        `SELECT DISTINCT u.id AS usuario_id, u.nombre, u.email,
                cl.id AS club_id, cl.email AS club_email, cl.nombre AS club_nombre
         FROM inscripciones i
         JOIN convocatorias c ON i.convocatoria_id = c.id
         JOIN atletas a       ON i.atleta_id = a.id
         JOIN usuarios u      ON a.usuario_id = u.id
         LEFT JOIN clubes cl  ON a.club_id = cl.id
         WHERE c.evento_id = $1`,
        [eventoId]
      )
      if (inscritos.length > 0) {
        const mensaje = `El evento "${rows[0].titulo}" ha finalizado.`
        await NotificacionModel.crearParaVarios(inscritos.map((i) => i.usuario_id), mensaje)
        inscritosParaEmail = inscritos

        const clubesUnicos = [...new Map(
          inscritos.filter((i) => i.club_id).map((i) => [i.club_id, i])
        ).values()]
        for (const club of clubesUnicos) {
          await NotificacionModel.crearParaClub(club.club_id, mensaje)
        }
        clubesParaEmail = clubesUnicos
      }
    }

    await client.query('COMMIT')

    if (inscritosParaEmail) {
      for (const u of inscritosParaEmail) {
        await sendEventoFinalizadoEmail({
          to: u.email, nombre: u.nombre, eventoTitulo: rows[0].titulo,
        }).catch((err) => console.error(`No se pudo enviar el correo de evento finalizado a ${u.email}:`, err))
      }
      for (const club of (clubesParaEmail || [])) {
        const atletasDelClub = inscritosParaEmail.filter((i) => i.club_id === club.club_id).map((i) => i.nombre)
        await sendEventoFinalizadoClubEmail({
          to: club.club_email, clubNombre: club.club_nombre, eventoTitulo: rows[0].titulo,
          atletas: atletasDelClub,
        }).catch((err) => console.error(`No se pudo enviar el correo de evento finalizado al club ${club.club_email}:`, err))
      }
    }

    return rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}