var pool = require('../config/db');

// POST /api/resultados
function crear(req, res) {
    var eventoId       = req.body.eventoId;
    var atletaId       = req.body.atletaId;
    var entrenadorId   = req.body.entrenadorId  || null;
    var categoriaId    = req.body.categoriaId   || null;
    var generoId       = req.body.generoId      || null;
    var disciplinaId   = req.body.disciplinaId  || null;
    var anoCompetitivo = req.body.añoCompetitivo || new Date().getFullYear();
    var pruebas        = req.body.pruebas        || [];

    if (!eventoId || !atletaId) {
        return res.status(400).json({ message: 'Evento y atleta son obligatorios' });
    }

    Promise.all([
        pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId]),
        pool.query('SELECT id FROM usuarios u JOIN atletas a ON u.id = a.usuario_id WHERE u.id = $1', [atletaId]),
        entrenadorId
            ? pool.query('SELECT id FROM entrenadores WHERE id = $1', [entrenadorId])
            : Promise.resolve({ rows: [{}] })
    ])
    .then(function(results) {
        if (results[0].rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
        if (results[1].rows.length === 0) return Promise.reject({ status: 404, message: 'Atleta no encontrado' });
        if (entrenadorId && results[2].rows.length === 0) return Promise.reject({ status: 404, message: 'Entrenador no encontrado' });

        return pool.query(
            `INSERT INTO resultados
             (evento_id, atleta_id, entrenador_id, categoria_id, genero_id, disciplina_id, ano_competitivo, fecha_registro)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`,
            [eventoId, atletaId, entrenadorId, categoriaId, generoId, disciplinaId, anoCompetitivo]
        );
    })
    .then(function(r) {
        var resultadoId = r.rows[0].id;
        // Insertar pruebas en tabla separada pruebas_resultado
        if (pruebas.length === 0) return res.status(201).json({ message: 'Resultado registrado', id: resultadoId });
        var promesas = pruebas.map(function(p) {
            return pool.query(
                'INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad) VALUES ($1,$2,$3,$4)',
                [resultadoId, p.nombre || p.name || '', p.marca || p.mark || '', p.unidad || p.unit || '']
            );
        });
        return Promise.all(promesas).then(function() {
            res.status(201).json({ message: 'Resultado registrado correctamente', id: resultadoId });
        });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error('❌ Error al crear resultado:', err);
        res.status(500).json({ message: 'Error al crear resultado', error: err.message });
    });
}

// GET /api/resultados — con JOIN a pruebas_resultado
function listar(req, res) {
    var eventoId       = req.query.eventoId;
    var atletaId       = req.query.atletaId;
    var disciplinaId   = req.query.disciplinaId;
    var anoCompetitivo = req.query.añoCompetitivo;
    var limit          = parseInt(req.query.limit) || 100;

    var query = `
        SELECT r.*,
               u.nombre, u.apellido_paterno, u.apellido_materno,
               e.titulo AS nombre_evento, e.fecha AS fecha_evento,
               d.nombre AS disciplina_nombre,
               cat.nombre AS categoria_nombre,
               g.nombre AS genero_nombre,
               json_agg(json_build_object('id',pr.id,'nombre',pr.nombre,'marca',pr.marca,'unidad',pr.unidad))
                   FILTER (WHERE pr.id IS NOT NULL) AS pruebas
        FROM resultados r
        JOIN usuarios u ON r.atleta_id = u.id
        LEFT JOIN eventos e ON r.evento_id = e.id
        LEFT JOIN disciplinas d ON r.disciplina_id = d.id
        LEFT JOIN categorias cat ON r.categoria_id = cat.id
        LEFT JOIN generos g ON r.genero_id = g.id
        LEFT JOIN pruebas_resultado pr ON r.id = pr.resultado_id
        WHERE 1=1
    `;
    var params = [];

    if (eventoId)       { params.push(eventoId);                 query += ' AND r.evento_id = $' + params.length; }
    if (atletaId)       { params.push(atletaId);                 query += ' AND r.atleta_id = $' + params.length; }
    if (disciplinaId)   { params.push(disciplinaId);             query += ' AND r.disciplina_id = $' + params.length; }
    if (anoCompetitivo) { params.push(parseInt(anoCompetitivo)); query += ' AND r.ano_competitivo = $' + params.length; }

    query += ' GROUP BY r.id, u.nombre, u.apellido_paterno, u.apellido_materno, e.titulo, e.fecha, d.nombre, cat.nombre, g.nombre';
    query += ' ORDER BY r.fecha_registro DESC LIMIT ' + limit;

    pool.query(query, params)
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) {
            console.error('❌ Error al obtener resultados:', err);
            res.status(500).json({ message: 'Error al obtener resultados', error: err.message });
        });
}

// GET /api/resultados/:id
function obtener(req, res) {
    pool.query(
        `SELECT r.*,
                u.nombre, u.apellido_paterno,
                e.titulo AS nombre_evento,
                d.nombre AS disciplina,
                cat.nombre AS categoria,
                g.nombre AS genero,
                json_agg(json_build_object('id',pr.id,'nombre',pr.nombre,'marca',pr.marca,'unidad',pr.unidad))
                    FILTER (WHERE pr.id IS NOT NULL) AS pruebas
         FROM resultados r
         JOIN usuarios u ON r.atleta_id = u.id
         LEFT JOIN eventos e ON r.evento_id = e.id
         LEFT JOIN disciplinas d ON r.disciplina_id = d.id
         LEFT JOIN categorias cat ON r.categoria_id = cat.id
         LEFT JOIN generos g ON r.genero_id = g.id
         LEFT JOIN pruebas_resultado pr ON r.id = pr.resultado_id
         WHERE r.id = $1
         GROUP BY r.id, u.nombre, u.apellido_paterno, e.titulo, d.nombre, cat.nombre, g.nombre`,
        [req.params.id]
    )
    .then(function(r) {
        if (r.rows.length === 0) return res.status(404).json({ message: 'Resultado no encontrado' });
        res.json(r.rows[0]);
    })
    .catch(function(err) { res.status(500).json({ message: 'Error al obtener resultado', error: err.message }); });
}

// PUT /api/resultados/:id
function actualizar(req, res) {
    var id  = req.params.id;
    var campos = { categoria_id: 'categoriaId', genero_id: 'generoId', disciplina_id: 'disciplinaId',
                   entrenador_id: 'entrenadorId', ano_competitivo: 'añoCompetitivo' };
    var sets = []; var params = [];

    Object.keys(campos).forEach(function(col) {
        var bodyKey = campos[col];
        if (req.body[bodyKey] !== undefined) {
            params.push(req.body[bodyKey]);
            sets.push(col + ' = $' + params.length);
        }
    });

    var promesas = [];
    if (sets.length > 0) {
        params.push(id);
        promesas.push(pool.query('UPDATE resultados SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params));
    }
    // Actualizar pruebas: borrar e insertar
    if (req.body.pruebas !== undefined) {
        promesas.push(
            pool.query('DELETE FROM pruebas_resultado WHERE resultado_id = $1', [id])
                .then(function() {
                    var pp = req.body.pruebas.map(function(p) {
                        return pool.query('INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad) VALUES ($1,$2,$3,$4)',
                            [id, p.nombre || '', p.marca || '', p.unidad || '']);
                    });
                    return Promise.all(pp);
                })
        );
    }

    Promise.all(promesas)
        .then(function() { res.json({ message: 'Resultado actualizado correctamente' }); })
        .catch(function(err) { res.status(500).json({ message: 'Error al actualizar resultado', error: err.message }); });
}

// DELETE /api/resultados/:id
function eliminar(req, res) {
    pool.query('DELETE FROM pruebas_resultado WHERE resultado_id = $1', [req.params.id])
        .then(function() { return pool.query('DELETE FROM resultados WHERE id = $1', [req.params.id]); })
        .then(function(r) {
            if (r.rowCount === 0) return res.status(404).json({ message: 'Resultado no encontrado' });
            res.json({ message: 'Resultado eliminado correctamente' });
        })
        .catch(function(err) { res.status(500).json({ message: 'Error al eliminar resultado', error: err.message }); });
}

// GET /api/resultados/evento/:eventoId
function porEvento(req, res) {
    pool.query('SELECT * FROM resultados WHERE evento_id = $1 ORDER BY fecha_registro DESC', [req.params.eventoId])
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ message: 'Error al obtener resultados del evento', error: err.message }); });
}

// GET /api/resultados/atleta/:atletaId
function porAtleta(req, res) {
    pool.query('SELECT * FROM resultados WHERE atleta_id = $1 ORDER BY fecha_registro DESC', [req.params.atletaId])
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) { res.status(500).json({ message: 'Error al obtener resultados del atleta', error: err.message }); });
}

// GET /api/resultados/club/:clubId — busca por atletas del club
function porClub(req, res) {
    var clubId = req.params.clubId;
    pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Club no encontrado' });
            return pool.query(
                `SELECT r.* FROM resultados r
                 JOIN atletas a ON r.atleta_id = a.usuario_id
                 WHERE a.club_id = $1 ORDER BY r.fecha_registro DESC`,
                [clubId]
            );
        })
        .then(function(r) { res.json(r.rows); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener resultados del club', error: err.message });
        });
}

// GET /api/resultados/entrenador/:entrenadorId
function porEntrenador(req, res) {
    pool.query(
        `SELECT e.id FROM entrenadores e JOIN usuarios u ON e.usuario_id = u.id WHERE u.id = $1`,
        [req.params.entrenadorId]
    )
    .then(function(r) {
        if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Entrenador no encontrado' });
        var entId = r.rows[0].id;
        return pool.query('SELECT * FROM resultados WHERE entrenador_id = $1 ORDER BY fecha_registro DESC', [entId]);
    })
    .then(function(r) { res.json(r.rows); })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        res.status(500).json({ message: 'Error al obtener resultados del entrenador', error: err.message });
    });
}

// GET /api/resultados/estadisticas/generales
function estadisticasGenerales(req, res) {
    pool.query(
        `SELECT COUNT(*) AS total_resultados,
                COUNT(DISTINCT evento_id) AS total_eventos,
                COUNT(DISTINCT atleta_id) AS total_atletas
         FROM resultados`
    )
    .then(function(r) { res.json(r.rows[0] || {}); })
    .catch(function(err) { res.status(500).json({ message: 'Error al obtener estadísticas', error: err.message }); });
}

// GET /api/resultados/estadisticas/club/:clubId
function estadisticasClub(req, res) {
    pool.query('SELECT id FROM clubes WHERE id = $1', [req.params.clubId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Club no encontrado' });
            return pool.query(
                `SELECT COUNT(*) AS total_resultados,
                        COUNT(DISTINCT r.atleta_id) AS total_atletas,
                        COUNT(DISTINCT r.evento_id) AS total_eventos
                 FROM resultados r
                 JOIN atletas a ON r.atleta_id = a.usuario_id
                 WHERE a.club_id = $1`,
                [req.params.clubId]
            );
        })
        .then(function(r) { res.json(r.rows[0] || {}); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener estadísticas del club', error: err.message });
        });
}

module.exports = {
    crear, listar, obtener, actualizar, eliminar,
    porEvento, porAtleta, porClub, porEntrenador,
    estadisticasGenerales, estadisticasClub
};
