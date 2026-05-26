var pool = require('../config/db');

// POST /api/eventos — Crear evento con convocatorias
function crearEvento(req, res) {
    var titulo        = req.body.titulo;
    var fecha         = req.body.fecha;
    var hora          = req.body.hora;
    var lugar         = req.body.lugar;
    var descripcion   = req.body.descripcion || '';
    var convocatorias = req.body.convocatorias; // array

    if (!titulo || !fecha || !hora || !lugar || !convocatorias || !Array.isArray(convocatorias) || convocatorias.length === 0) {
        return res.status(400).json({ message: 'Título, fecha, hora, lugar y al menos una convocatoria son requeridos' });
    }

    // Validar cada convocatoria
    for (var i = 0; i < convocatorias.length; i++) {
        var conv = convocatorias[i];
        if (!conv.disciplina || !conv.categoria || !conv.genero ||
            conv.edadMin === undefined || conv.edadMax === undefined) {
            return res.status(400).json({ message: 'Convocatoria ' + (i+1) + ': disciplina, categoría, género, edad mínima y máxima son requeridos' });
        }
        if (isNaN(parseInt(conv.edadMin)) || isNaN(parseInt(conv.edadMax))) {
            return res.status(400).json({ message: 'Convocatoria ' + (i+1) + ': edades deben ser números' });
        }
    }

    // Calcular fecha cierre (24h antes del evento)
    var fechaEvento  = new Date(fecha);
    var fechaCierre  = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000);

    // Insertar evento
    pool.query(
        `INSERT INTO eventos (nombre, fecha, hora, lugar, descripcion, estado, fecha_plazo_inscripcion, created_at)
         VALUES ($1,$2,$3,$4,$5,true,$6,NOW()) RETURNING id`,
        [titulo.trim(), fechaEvento, hora.trim(), lugar.trim(), descripcion.trim(), fechaCierre]
    )
    .then(function(result) {
        var eventoId = result.rows[0].id;

        // Buscar o crear disciplinas/categorías/géneros y crear convocatorias
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
                        return pool.query(
                            'INSERT INTO categorias (nombre, edad_min, edad_max) VALUES ($1,$2,$3) RETURNING id',
                            [conv.categoria.trim(), parseInt(conv.edadMin), parseInt(conv.edadMax)]
                        ).then(function(r2) { return r2.rows[0].id; });
                    }),
                pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [conv.genero.trim()])
                    .then(function(r) { return r.rows.length > 0 ? r.rows[0].id : null; })
            ]).then(function(ids) {
                return pool.query(
                    `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id, estado, created_at)
                     VALUES ($1,$2,$3,$4,true,NOW())`,
                    [eventoId, ids[0], ids[1], ids[2]]
                );
            });
        });

        return Promise.all(promesas).then(function() { return eventoId; });
    })
    .then(function(eventoId) {
        return obtenerEventoCompleto(eventoId);
    })
    .then(function(evento) {
        res.status(201).json(evento);
    })
    .catch(function(err) {
        console.error('❌ Error al crear evento:', err);
        res.status(500).json({ message: 'Error al crear el evento', error: err.message });
    });
}

// Helper interno para obtener evento con convocatorias
function obtenerEventoCompleto(eventoId) {
    return pool.query(
        `SELECT e.*,
                json_agg(json_build_object(
                    'id', c.id,
                    'disciplina', d.nombre,
                    'categoria', cat.nombre,
                    'genero', g.nombre,
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

// GET /api/eventos
function listarEventos(req, res) {
    var limit = req.query.limit;
    var query = `
        SELECT e.id, e.nombre AS titulo, e.fecha, e.hora, e.lugar, e.descripcion,
               e.estado, e.fecha_plazo_inscripcion AS fecha_cierre, e.created_at,
               COUNT(DISTINCT i.id) AS total_inscritos
        FROM eventos e
        LEFT JOIN inscripciones i ON e.id = i.evento_id
        WHERE e.estado = true
        GROUP BY e.id
        ORDER BY e.created_at DESC
    `;
    if (limit && !isNaN(parseInt(limit))) query += ' LIMIT ' + parseInt(limit);

    pool.query(query)
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            console.error('❌ Error al obtener eventos:', err);
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
        `SELECT e.id AS evento_id, e.nombre AS titulo, e.fecha, e.hora, e.lugar, e.descripcion,
                e.fecha_plazo_inscripcion AS fecha_cierre, e.estado,
                c.id AS convocatoria_id,
                d.nombre AS disciplina, cat.nombre AS categoria,
                cat.edad_min AS edad_min, cat.edad_max AS edad_max,
                g.nombre AS genero
         FROM eventos e
         JOIN convocatorias c ON e.id = c.evento_id
         JOIN disciplinas d ON c.disciplina_id = d.id
         JOIN categorias cat ON c.categoria_id = cat.id
         JOIN generos g ON c.genero_id = g.id
         WHERE e.fecha_plazo_inscripcion > NOW()
           AND e.estado = true
           AND c.estado = true
           AND cat.edad_min <= $1
           AND cat.edad_max >= $1
           AND (LOWER(g.nombre) = $2 OR LOWER(g.nombre) = 'mixto')`,
        [edad, genero]
    )
    .then(function(result) { res.json(result.rows); })
    .catch(function(err) {
        console.error('❌ Error al filtrar convocatorias:', err);
        res.status(500).json({ message: 'Error al filtrar convocatorias', error: err.message });
    });
}

// POST /api/eventos/inscripciones
function crearInscripcion(req, res) {
    var eventoId    = req.body.eventoId;
    var atletaId    = req.body.atletaId;
    var datosAtleta = req.body.datosAtleta || {};

    if (!eventoId || !atletaId) return res.status(400).json({ message: 'Evento y atleta son requeridos' });

    Promise.all([
        pool.query('SELECT * FROM eventos WHERE id = $1', [eventoId]),
        pool.query(`SELECT u.*, g.nombre AS sexo FROM usuarios u LEFT JOIN generos g ON u.genero_id = g.id WHERE u.id = $1`, [atletaId])
    ])
    .then(function(results) {
        var evento = results[0].rows[0];
        var atleta = results[1].rows[0];

        if (!evento) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
        if (!atleta) return Promise.reject({ status: 404, message: 'Atleta no encontrado' });

        if (new Date() > new Date(evento.fecha_plazo_inscripcion)) {
            return Promise.reject({ status: 400, message: 'La convocatoria ya está cerrada' });
        }

        return pool.query('SELECT id FROM inscripciones WHERE evento_id = $1 AND atleta_id = $2', [eventoId, atletaId])
            .then(function(r) {
                if (r.rows.length > 0) return Promise.reject({ status: 400, message: 'Ya estás inscrito en este evento' });

                var fechaNac = new Date(atleta.fecha_nacimiento);
                var hoy      = new Date();
                var edad     = hoy.getFullYear() - fechaNac.getFullYear();
                var mes      = hoy.getMonth() - fechaNac.getMonth();
                var edadReal = (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) ? edad - 1 : edad;

                return pool.query(
                    `INSERT INTO inscripciones (atleta_id, evento_id, fecha_inscripcion, validado)
                     VALUES ($1,$2,NOW(),true) RETURNING id`,
                    [atletaId, eventoId]
                ).then(function(r2) {
                    res.status(201).json({
                        message: 'Inscripción exitosa',
                        id: r2.rows[0].id,
                        validaciones: { edad: edadReal, genero: atleta.sexo }
                    });
                });
            });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error('❌ Error al registrar inscripción:', err);
        res.status(500).json({ message: 'Error al registrar inscripción', error: err.message });
    });
}

// GET /api/eventos/inscripciones?atletaId=...&eventoId=...
function listarInscripciones(req, res) {
    var atletaId = req.query.atletaId;
    var eventoId = req.query.eventoId;
    var query    = 'SELECT * FROM inscripciones WHERE 1=1';
    var params   = [];

    if (atletaId) { params.push(atletaId); query += ' AND atleta_id = $' + params.length; }
    if (eventoId) { params.push(eventoId); query += ' AND evento_id = $' + params.length; }

    pool.query(query, params)
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al obtener inscripciones', error: err.message });
        });
}

// GET /api/eventos/:eventoId/participantes
function participantes(req, res) {
    var eventoId = req.params.eventoId;

    pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
            return pool.query(
                `SELECT i.id, i.atleta_id, i.fecha_inscripcion, i.validado,
                        u.nombre, u.apellido_paterno, u.apellido_materno
                 FROM inscripciones i
                 JOIN usuarios u ON i.atleta_id = u.id
                 WHERE i.evento_id = $1
                 ORDER BY i.fecha_inscripcion ASC`,
                [eventoId]
            );
        })
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            console.error('❌ Error al obtener participantes:', err);
            res.status(500).json({ message: 'Error al obtener participantes', error: err.message });
        });
}

// PUT /api/eventos/:id/actualizar-fecha-cierre
function actualizarFechaCierre(req, res) {
    var fechaCierre = req.body.fechaCierre;
    if (!fechaCierre) return res.status(400).json({ message: 'Fecha de cierre es requerida' });

    var nuevaFecha = new Date(fechaCierre);
    if (isNaN(nuevaFecha.getTime())) return res.status(400).json({ message: 'Fecha de cierre inválida' });

    pool.query('UPDATE eventos SET fecha_plazo_inscripcion = $1 WHERE id = $2', [nuevaFecha, req.params.id])
        .then(function(result) {
            if (result.rowCount === 0) return res.status(404).json({ message: 'Evento no encontrado' });
            res.json({ message: 'Fecha de cierre actualizada exitosamente' });
        })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al actualizar fecha de cierre', error: err.message });
        });
}

// POST /api/eventos/:eventoId/convocatorias — Agregar convocatoria a evento existente
function agregarConvocatoria(req, res) {
    var eventoId = req.params.eventoId;
    var conv     = req.body;

    if (!conv.disciplina || !conv.categoria || !conv.genero || conv.edadMin === undefined || conv.edadMax === undefined) {
        return res.status(400).json({ message: 'Disciplina, categoría, género, edadMin y edadMax son requeridos' });
    }

    pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
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
        .then(function() {
            return obtenerEventoCompleto(eventoId);
        })
        .then(function(evento) { res.json(evento); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al agregar convocatoria', error: err.message });
        });
}

module.exports = {
    crearEvento, listarEventos, convocatoriasParaAtleta,
    crearInscripcion, listarInscripciones, participantes,
    actualizarFechaCierre, agregarConvocatoria
};
