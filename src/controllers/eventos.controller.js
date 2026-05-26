var pool = require('../config/db');

// Helper para obtener evento completo con convocatorias
function obtenerEventoCompleto(eventoId) {
    return pool.query(
        `SELECT e.*,
                json_agg(json_build_object(
                    'id', c.id,
                    'disciplina', d.nombre,
                    'disciplina_id', c.disciplina_id,
                    'categoria', cat.nombre,
                    'categoria_id', c.categoria_id,
                    'genero', g.nombre,
                    'genero_id', c.genero_id,
                    'edadMin', cat.edad_min,
                    'edadMax', cat.edad_max,
                    'estado', c.estado
                )) FILTER (WHERE c.id IS NOT NULL) AS convocatorias
         FROM eventos e
         LEFT JOIN convocatorias c ON e.id = c.evento_id
         LEFT JOIN disciplinas d ON c.disciplina_id = d.id
         LEFT JOIN categorias cat ON c.categoria_id = cat.id
         LEFT JOIN generos g ON c.genero_id = g.id
         WHERE e.id = $1
         GROUP BY e.id`,
        [eventoId]
    ).then(function(r) { return r.rows[0]; });
}

// POST /api/eventos
function crearEvento(req, res) {
    var titulo        = req.body.titulo;
    var fecha         = req.body.fecha;
    var hora          = req.body.hora;
    var lugar         = req.body.lugar;
    var descripcion   = req.body.descripcion || '';
    var convocatorias = req.body.convocatorias;

    if (!titulo || !fecha || !hora || !lugar || !convocatorias || !Array.isArray(convocatorias) || convocatorias.length === 0) {
        return res.status(400).json({ message: 'Título, fecha, hora, lugar y al menos una convocatoria son requeridos' });
    }

    for (var i = 0; i < convocatorias.length; i++) {
        var conv = convocatorias[i];
        if (!conv.disciplina || !conv.categoria || !conv.genero || conv.edadMin === undefined || conv.edadMax === undefined) {
            return res.status(400).json({ message: 'Convocatoria ' + (i + 1) + ': disciplina, categoría, género, edadMin y edadMax son requeridos' });
        }
    }

    // fecha_cierre = 24h antes del evento (igual que el original)
    var fechaEvento  = new Date(fecha);
    var fechaCierre  = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000);

    pool.query(
        `INSERT INTO eventos (titulo, fecha, hora, lugar, descripcion, estado, fecha_cierre, created_at)
         VALUES ($1,$2,$3,$4,$5,true,$6,NOW()) RETURNING id`,
        [titulo.trim(), fechaEvento, hora.trim(), lugar.trim(), descripcion.trim(), fechaCierre]
    )
    .then(function(result) {
        var eventoId = result.rows[0].id;

        var promesas = convocatorias.map(function(conv) {
            return Promise.all([
                pool.query('SELECT id FROM disciplinas WHERE LOWER(nombre) = LOWER($1)', [conv.disciplina.trim()])
                    .then(function(r) {
                        if (r.rows.length > 0) return r.rows[0].id;
                        return pool.query('INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING id', [conv.disciplina.trim()])
                            .then(function(r2) { return r2.rows[0].id; });
                    }),
                pool.query('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1)', [conv.categoria.trim()])
                    .then(function(r) {
                        if (r.rows.length > 0) return r.rows[0].id;
                        return pool.query('INSERT INTO categorias (nombre, edad_min, edad_max) VALUES ($1,$2,$3) RETURNING id',
                            [conv.categoria.trim(), parseInt(conv.edadMin), parseInt(conv.edadMax)])
                            .then(function(r2) { return r2.rows[0].id; });
                    }),
                pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [conv.genero.trim()])
                    .then(function(r) { return r.rows.length > 0 ? r.rows[0].id : null; })
            ]).then(function(ids) {
                return pool.query(
                    'INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id, estado, created_at) VALUES ($1,$2,$3,$4,true,NOW())',
                    [eventoId, ids[0], ids[1], ids[2]]
                );
            });
        });

        return Promise.all(promesas).then(function() { return eventoId; });
    })
    .then(function(eventoId) { return obtenerEventoCompleto(eventoId); })
    .then(function(evento) { res.status(201).json(evento); })
    .catch(function(err) {
        console.error('❌ Error al crear evento:', err);
        res.status(500).json({ message: 'Error al crear el evento', error: err.message });
    });
}

// GET /api/eventos
function listarEventos(req, res) {
    var limit = req.query.limit;
    var query = `
        SELECT e.id, e.titulo, e.fecha, e.hora, e.lugar, e.descripcion,
               e.estado, e.fecha_cierre, e.created_at,
               COUNT(DISTINCT i.id) AS total_inscritos
        FROM eventos e
        LEFT JOIN inscripciones i ON i.convocatoria_id IN (SELECT id FROM convocatorias WHERE evento_id = e.id)
        WHERE e.estado = true
        GROUP BY e.id
        ORDER BY e.created_at DESC
    `;
    if (limit && !isNaN(parseInt(limit))) query += ' LIMIT ' + parseInt(limit);

    pool.query(query)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al obtener eventos', error: err.message });
        });
}

// GET /api/eventos/convocatorias-para-atleta?edad=17&genero=masculino
function convocatoriasParaAtleta(req, res) {
    var edad   = Number(req.query.edad);
    var genero = (req.query.genero || '').toLowerCase();

    if (isNaN(edad)) return res.status(400).json({ message: 'Edad inválida o no proporcionada' });
    if (!genero)     return res.status(400).json({ message: 'Género es requerido' });

    pool.query(
        `SELECT e.id AS _id, e.titulo, e.fecha, e.hora, e.lugar, e.descripcion,
                e.fecha_cierre AS fechaCierre, e.estado,
                c.id AS convocatoriaId,
                d.nombre AS disciplina, cat.nombre AS categoria,
                cat.edad_min AS edadMin, cat.edad_max AS edadMax,
                g.nombre AS genero, g.nombre AS paraPersonas
         FROM eventos e
         JOIN convocatorias c ON e.id = c.evento_id
         JOIN disciplinas d ON c.disciplina_id = d.id
         JOIN categorias cat ON c.categoria_id = cat.id
         JOIN generos g ON c.genero_id = g.id
         WHERE e.fecha_cierre > NOW()
           AND e.estado = true
           AND c.estado = true
           AND cat.edad_min <= $1
           AND cat.edad_max >= $1
           AND (LOWER(g.nombre) = $2 OR LOWER(g.nombre) = 'mixto')`,
        [edad, genero]
    )
    .then(function(r) { res.json(r.rows); })
    .catch(function(err) {
        res.status(500).json({ message: 'Error al filtrar convocatorias', error: err.message });
    });
}

// POST /api/eventos/inscripciones
function crearInscripcion(req, res) {
    var eventoId      = req.body.eventoId;
    var atletaId      = req.body.atletaId;
    var convocatoriaId = req.body.convocatoriaId || req.body.datosAtleta && req.body.datosAtleta.convocatoriaId;

    if (!eventoId || !atletaId) return res.status(400).json({ message: 'Evento y atleta son requeridos' });

    Promise.all([
        pool.query('SELECT e.*, e.fecha_cierre FROM eventos e WHERE e.id = $1', [eventoId]),
        pool.query(`SELECT u.*, g.nombre AS sexo FROM usuarios u LEFT JOIN generos g ON u.genero_id = g.id WHERE u.id = $1`, [atletaId])
    ])
    .then(function(results) {
        var evento = results[0].rows[0];
        var atleta = results[1].rows[0];
        if (!evento) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
        if (!atleta) return Promise.reject({ status: 404, message: 'Atleta no encontrado' });
        if (new Date() > new Date(evento.fecha_cierre)) {
            return Promise.reject({ status: 400, message: 'La convocatoria ya está cerrada' });
        }
        // Verificar duplicado — por convocatoria si se envió, si no por evento
        var checkQuery = convocatoriaId
            ? pool.query('SELECT id FROM inscripciones WHERE atleta_id = $1 AND convocatoria_id = $2', [atletaId, convocatoriaId])
            : pool.query('SELECT i.id FROM inscripciones i JOIN convocatorias c ON i.convocatoria_id = c.id WHERE i.atleta_id = $1 AND c.evento_id = $2', [atletaId, eventoId]);

        return checkQuery.then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, message: 'Ya estás inscrito en este evento' });
            return pool.query(
                'INSERT INTO inscripciones (atleta_id, convocatoria_id, fecha_inscripcion, validado) VALUES ($1,$2,NOW(),true) RETURNING id',
                [atletaId, convocatoriaId || null]
            );
        }).then(function(r2) {
            var hoy = new Date(); var fn = new Date(atleta.fecha_nacimiento);
            var edad = hoy.getFullYear() - fn.getFullYear();
            var mes  = hoy.getMonth() - fn.getMonth();
            var edadReal = (mes < 0 || (mes === 0 && hoy.getDate() < fn.getDate())) ? edad - 1 : edad;
            res.status(201).json({ message: 'Inscripción exitosa', id: r2.rows[0].id, validaciones: { edad: edadReal, genero: atleta.sexo } });
        });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        res.status(500).json({ message: 'Error al registrar inscripción', error: err.message });
    });
}

// GET /api/eventos/inscripciones
function listarInscripciones(req, res) {
    var atletaId = req.query.atletaId;
    var eventoId = req.query.eventoId;
    var query    = `SELECT i.*, c.evento_id FROM inscripciones i
                    LEFT JOIN convocatorias c ON i.convocatoria_id = c.id WHERE 1=1`;
    var params   = [];
    if (atletaId) { params.push(atletaId); query += ' AND i.atleta_id = $' + params.length; }
    if (eventoId) { params.push(eventoId); query += ' AND c.evento_id = $' + params.length; }

    pool.query(query, params)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ message: 'Error al obtener inscripciones', error: err.message }); });
}

// GET /api/eventos/:eventoId/participantes
function participantes(req, res) {
    pool.query('SELECT id FROM eventos WHERE id = $1', [req.params.eventoId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
            return pool.query(
                `SELECT i.id, i.atleta_id, i.fecha_inscripcion, i.validado,
                        u.nombre, u.apellido_paterno, u.apellido_materno,
                        c.id AS convocatoria_id
                 FROM inscripciones i
                 JOIN convocatorias c ON i.convocatoria_id = c.id
                 JOIN usuarios u ON i.atleta_id = u.id
                 WHERE c.evento_id = $1
                 ORDER BY i.fecha_inscripcion ASC`,
                [req.params.eventoId]
            );
        })
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener participantes', error: err.message });
        });
}

// PUT /api/eventos/:id/actualizar-fecha-cierre
function actualizarFechaCierre(req, res) {
    var fechaCierre = req.body.fechaCierre;
    if (!fechaCierre) return res.status(400).json({ message: 'Fecha de cierre es requerida' });
    pool.query('UPDATE eventos SET fecha_cierre = $1 WHERE id = $2', [new Date(fechaCierre), req.params.id])
        .then(function(r) {
            if (r.rowCount === 0) return res.status(404).json({ message: 'Evento no encontrado' });
            res.json({ message: 'Fecha de cierre actualizada exitosamente' });
        })
        .catch(function(err) { res.status(500).json({ message: 'Error al actualizar fecha de cierre', error: err.message }); });
}

// POST /api/eventos/:eventoId/convocatorias
function agregarConvocatoria(req, res) {
    var eventoId = req.params.eventoId;
    var conv     = req.body;

    if (!conv.disciplina || !conv.categoria || !conv.genero || conv.edadMin === undefined || conv.edadMax === undefined) {
        return res.status(400).json({ message: 'Disciplina, categoría, género, edadMin y edadMax son requeridos' });
    }

    pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
            return Promise.all([
                pool.query('SELECT id FROM disciplinas WHERE LOWER(nombre) = LOWER($1)', [conv.disciplina.trim()])
                    .then(function(r) {
                        if (r.rows.length > 0) return r.rows[0].id;
                        return pool.query('INSERT INTO disciplinas (nombre) VALUES ($1) RETURNING id', [conv.disciplina.trim()])
                            .then(function(r2) { return r2.rows[0].id; });
                    }),
                pool.query('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1)', [conv.categoria.trim()])
                    .then(function(r) {
                        if (r.rows.length > 0) return r.rows[0].id;
                        return pool.query('INSERT INTO categorias (nombre, edad_min, edad_max) VALUES ($1,$2,$3) RETURNING id',
                            [conv.categoria.trim(), parseInt(conv.edadMin), parseInt(conv.edadMax)])
                            .then(function(r2) { return r2.rows[0].id; });
                    }),
                pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [conv.genero.trim()])
                    .then(function(r) { return r.rows.length > 0 ? r.rows[0].id : null; })
            ]);
        })
        .then(function(ids) {
            return pool.query(
                'INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id, estado, created_at) VALUES ($1,$2,$3,$4,true,NOW())',
                [eventoId, ids[0], ids[1], ids[2]]
            );
        })
        .then(function() { return obtenerEventoCompleto(eventoId); })
        .then(function(evento) { res.json(evento); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al agregar convocatoria', error: err.message });
        });
}

// GET /api/eventos/debug-atleta/:atletaId
function debugAtleta(req, res) {
    pool.query(
        `SELECT u.id, u.nombre, u.curp, u.fecha_nacimiento, g.nombre AS sexo
         FROM usuarios u LEFT JOIN generos g ON u.genero_id = g.id WHERE u.id = $1`,
        [req.params.atletaId]
    ).then(function(r) {
        if (r.rows.length === 0) return res.status(404).json({ message: 'Atleta no encontrado' });
        var atleta = r.rows[0];
        var hoy = new Date(); var fn = new Date(atleta.fecha_nacimiento);
        var edad = hoy.getFullYear() - fn.getFullYear();
        var mes  = hoy.getMonth() - fn.getMonth();
        var edadReal = (mes < 0 || (mes === 0 && hoy.getDate() < fn.getDate())) ? edad - 1 : edad;
        res.json({ atleta: atleta, calculos: { edadCalculada: edadReal, genero: atleta.sexo } });
    }).catch(function(err) { res.status(500).json({ message: 'Error en debug atleta', error: err.message }); });
}

module.exports = {
    crearEvento, listarEventos, convocatoriasParaAtleta,
    crearInscripcion, listarInscripciones, participantes,
    actualizarFechaCierre, agregarConvocatoria, debugAtleta
};
