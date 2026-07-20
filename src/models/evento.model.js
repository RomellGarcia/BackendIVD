import { pool } from '../config/db.js'
import * as NotificacionModel from './notificacion.model.js'
import { sendConvocatoriaCanceladaEmail, sendEventoCanceladoEmail } from '../services/email.service.js'

//Todos los eventos activos
//Eventos. Por default solo trae los activos (para atletas/clubes); el
//admin puede pedir `todos=true` para ver también los cerrados.
export const findAll = async (limit, todos = false) => {
  const query = `
    SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.imagen_url, e.created_at,
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

//Un evento por ID con sus convocatorias
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT
      e.id, e.titulo, e.fecha, e.hora, e.lugar,
      e.descripcion, e.fecha_cierre, e.estado, e.imagen_url, e.created_at,
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

//Crear evento y sus convocatorias en una transacción
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

//Agregar convocatoria a evento existente
export const addConvocatoria = async (eventoId, { disciplina_id, categoria_id, genero_id }) => {
  const { rows } = await pool.query(
    `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventoId, disciplina_id, categoria_id, genero_id]
  )
  return rows[0]
}

//Actualizar fecha de cierre
export const updateFechaCierre = async (id, fecha_cierre) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET fecha_cierre = $1 WHERE id = $2 RETURNING *`,
    [fecha_cierre, id]
  )
  return rows[0] || null
}

//Convocatorias disponibles para un atleta (filtra por edad y género)
export const findConvocatoriasParaAtleta = async (atletaId) => {
  const { rows } = await pool.query(
    `SELECT
      e.id AS evento_id, e.titulo, e.fecha, e.hora,
      e.lugar, e.descripcion, e.fecha_cierre, e.imagen_url,
      c.id AS convocatoria_id,
      d.nombre AS disciplina,
      cat.nombre AS categoria, cat.edad_min, cat.edad_max,
      g.nombre AS genero
     FROM convocatorias c
     JOIN eventos e    ON c.evento_id = e.id
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     JOIN atletas a      ON a.id = $1
     JOIN usuarios u     ON a.usuario_id = u.id
     WHERE e.estado = true
       AND e.fecha_cierre > NOW()
       AND c.estado = true
       AND (
         DATE_PART('year', AGE(u.fecha_nacimiento)) BETWEEN cat.edad_min AND cat.edad_max
       )
       AND (
         g.nombre = u_genero.nombre OR g.nombre = 'mixto'
       )
     JOIN generos u_genero ON u.genero_id = u_genero.id
     ORDER BY e.fecha ASC`,
    [atletaId]
  )
  return rows
}


//Actualizar datos generales del evento (no toca convocatorias ni archivos)
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

//Marcar evento como activo/cerrado (no lo borra, solo cambia el estado)
export const toggleEstado = async (id, estado) => {
  const { rows } = await pool.query(
    `UPDATE eventos SET estado = $1 WHERE id = $2 RETURNING *`,
    [estado, id]
  )
  return rows[0] || null
}

//AGREGAR AL FINAL DE evento.model.js

//Convocatorias de un evento, con el estado de su documento de resultados
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

//Una convocatoria por id (para saber si ya tenía un documento antes de reemplazarlo)
export const findConvocatoriaById = async (convocatoriaId) => {
  const { rows } = await pool.query(`SELECT * FROM convocatorias WHERE id = $1`, [convocatoriaId])
  return rows[0] || null
}

//Guardar/reemplazar el documento de resultados de una convocatoria
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

//Quitar el documento de resultados (regresa el public_id viejo para poder
//borrarlo de Cloudinary desde el controlador)
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

//Elimina una convocatoria por completo. Si tenía atletas inscritos, los saca
//automáticamente y notifica a cada atleta (sistema + correo) y a su club,
//si pertenece a uno (sistema + correo).
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

    // Atletas inscritos, con su correo y el club al que pertenecen (si aplica)
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

    await client.query(`DELETE FROM inscripciones WHERE convocatoria_id = $1`, [convocatoriaId])
    await client.query(`DELETE FROM convocatorias WHERE id = $1`, [convocatoriaId])

    await client.query('COMMIT')

    if (inscritos.length > 0) {
      const mensaje = `Tu inscripción a "${convocatoria.disciplina} - ${convocatoria.categoria}" del evento "${convocatoria.evento_titulo}" fue cancelada porque esa convocatoria fue eliminada.`

      // Notificaciones dentro del sistema
      await NotificacionModel.crearParaVarios(inscritos.map(i => i.usuario_id), mensaje)

      const clubesUnicos = [...new Map(
        inscritos.filter(i => i.club_id).map(i => [i.club_id, i])
      ).values()]

      for (const club of clubesUnicos) {
        const mensajeClub = `La convocatoria "${convocatoria.disciplina} - ${convocatoria.categoria}" del evento "${convocatoria.evento_titulo}" fue cancelada. Uno o más de tus atletas fueron dados de baja automáticamente.`
        await NotificacionModel.crearParaClub(club.club_id, mensajeClub)
      }

      // Correos — no bloqueamos la respuesta si el envío falla
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
        sendConvocatoriaCanceladaEmail({
          to: club.club_email,
          nombre: club.club_nombre,
          disciplina: convocatoria.disciplina,
          categoria: convocatoria.categoria,
          eventoTitulo: convocatoria.evento_titulo,
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

//Elimina el evento completo (todas sus convocatorias e inscripciones).
//Notifica (sistema + correo) a todos los atletas afectados y a sus clubes.
//Regresa los public_id de Cloudinary para que el controlador los borre
//después (fuera de la transacción, ya que es una llamada externa a otra API).
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

    await client.query(
      `DELETE FROM inscripciones WHERE convocatoria_id IN (SELECT id FROM convocatorias WHERE evento_id = $1)`,
      [id]
    )
    await client.query(`DELETE FROM convocatorias WHERE evento_id = $1`, [id])
    await client.query(`DELETE FROM eventos WHERE id = $1`, [id])

    await client.query('COMMIT')

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
        sendEventoCanceladoEmail({
          to: club.club_email,
          nombre: club.club_nombre,
          eventoTitulo: evento.titulo,
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

//AGREGAR AL FINAL DE evento.model.js

//Actualizar disciplina/categoría/género de una convocatoria existente
//(sin borrarla ni afectar sus inscripciones). Los campos no enviados
//conservan su valor actual gracias al COALESCE.
export const updateConvocatoria = async (convocatoriaId, { disciplina_id, categoria_id, genero_id }) => {
  const { rows } = await pool.query(
    `UPDATE convocatorias SET
       disciplina_id = COALESCE($1, disciplina_id),
       categoria_id  = COALESCE($2, categoria_id),
       genero_id     = COALESCE($3, genero_id)
     WHERE id = $4
     RETURNING id`,
    [disciplina_id ?? null, categoria_id ?? null, genero_id ?? null, convocatoriaId]
  )
  if (!rows[0]) return null

  const { rows: joined } = await pool.query(
    `SELECT
      c.id,
      c.disciplina_id, d.nombre AS disciplina,
      c.categoria_id,  cat.nombre AS categoria,
      cat.edad_min AS "edadMin", cat.edad_max AS "edadMax",
      c.genero_id,     g.nombre AS genero,
      c.estado
     FROM convocatorias c
     JOIN disciplinas d  ON c.disciplina_id = d.id
     JOIN categorias cat ON c.categoria_id = cat.id
     JOIN generos g      ON c.genero_id = g.id
     WHERE c.id = $1`,
    [convocatoriaId]
  )
  return joined[0]
}