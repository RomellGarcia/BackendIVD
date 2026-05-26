// controllers/resultados.controller.js
var pool = require('../config/db');

// POST /api/resultados
function crear(req, res) {
    var eventoId          = req.body.eventoId;
    var convocatoriaIndex = req.body.convocatoriaIndex || 0;
    var atletaId          = req.body.atletaId;
    var categoria         = req.body.categoria;
    var sexo              = req.body.sexo          || 'no especificado';
    var municipio         = req.body.municipio     || '';
    var club              = req.body.club          || '';
    var anoCompetitivo    = req.body.añoCompetitivo || new Date().getFullYear();
    var pruebas           = req.body.pruebas       || [];
    var entrenadorId      = req.body.entrenadorId  || null;
    var lugarEntrenamiento = req.body.lugarEntrenamiento || '';

    if (!eventoId || !atletaId || !categoria) {
        return res.status(400).json({ message: 'Evento, atleta y categoría son obligatorios' });
    }

    Promise.all([
        pool.query('SELECT id, nombre AS titulo, fecha FROM eventos WHERE id = $1', [eventoId]),
        pool.query('SELECT u.id, u.nombre, u.apellido_paterno, u.apellido_materno FROM usuarios u JOIN atletas a ON u.id = a.usuario_id WHERE u.id = $1', [atletaId]),
        entrenadorId
            ? pool.query('SELECT u.id FROM usuarios u JOIN entrenadores e ON u.id = e.usuario_id WHERE u.id = $1', [entrenadorId])
            : Promise.resolve({ rows: [{}] })
    ])
    .then(function(results) {
        if (results[0].rows.length === 0) return Promise.reject({ status: 404, message: 'Evento no encontrado' });
        if (results[1].rows.length === 0) return Promise.reject({ status: 404, message: 'Atleta no encontrado' });
        if (entrenadorId && results[2].rows.length === 0) return Promise.reject({ status: 404, message: 'Entrenador no encontrado' });

        var evento = results[0].rows[0];
        var atleta = results[1].rows[0];
        var nombreAtleta = atleta.nombre + ' ' + atleta.apellido_paterno + ' ' + atleta.apellido_materno;

        return pool.query(
            `INSERT INTO resultados
             (evento_id, convocatoria_index, atleta_id, categoria, sexo, municipio, club,
              ano_competitivo, pruebas, entrenador_id, lugar_entrenamiento,
              nombre_atleta, nombre_evento, fecha_evento, fecha_registro)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
             RETURNING *`,
            [eventoId, convocatoriaIndex, atletaId, categoria, sexo, municipio, club,
             anoCompetitivo, JSON.stringify(pruebas), entrenadorId, lugarEntrenamiento,
             nombreAtleta, evento.titulo, evento.fecha]
        );
    })
    .then(function(r) {
        var row = r.rows[0];
        row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : row.pruebas;
        res.status(201).json(row);
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error('❌ Error al crear resultado:', err);
        res.status(500).json({ message: 'Error al crear resultado', error: err.message });
    });
}

// GET /api/resultados
function listar(req, res) {
    var eventoId       = req.query.eventoId;
    var atletaId       = req.query.atletaId;
    var categoria      = req.query.categoria;
    var club           = req.query.club;
    var anoCompetitivo = req.query.añoCompetitivo;
    var limit          = parseInt(req.query.limit) || 100;

    var query  = 'SELECT * FROM resultados WHERE 1=1';
    var params = [];

    if (eventoId)       { params.push(eventoId);            query += ' AND evento_id = $' + params.length; }
    if (atletaId)       { params.push(atletaId);            query += ' AND atleta_id = $' + params.length; }
    if (categoria)      { params.push(categoria);           query += ' AND categoria = $' + params.length; }
    if (club)           { params.push(club);                query += ' AND club = $' + params.length; }
    if (anoCompetitivo) { params.push(parseInt(anoCompetitivo)); query += ' AND ano_competitivo = $' + params.length; }

    query += ' ORDER BY fecha_registro DESC LIMIT ' + limit;

    pool.query(query, params)
        .then(function(r) {
            var rows = r.rows.map(function(row) {
                row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
                return row;
            });
            res.json(rows);
        })
        .catch(function(err) {
            console.error('❌ Error al obtener resultados:', err);
            res.status(500).json({ message: 'Error al obtener resultados', error: err.message });
        });
}

// GET /api/resultados/:id
function obtener(req, res) {
    pool.query('SELECT * FROM resultados WHERE id = $1', [req.params.id])
        .then(function(r) {
            if (r.rows.length === 0) return res.status(404).json({ message: 'Resultado no encontrado' });
            var row = r.rows[0];
            row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
            res.json(row);
        })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al obtener resultado', error: err.message });
        });
}

// PUT /api/resultados/:id
function actualizar(req, res) {
    var id = req.params.id;

    pool.query('SELECT * FROM resultados WHERE id = $1', [id])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Resultado no encontrado' });
            var actual = r.rows[0];

            var eventoId          = req.body.eventoId          || actual.evento_id;
            var convocatoriaIndex = req.body.convocatoriaIndex !== undefined ? req.body.convocatoriaIndex : actual.convocatoria_index;
            var atletaId          = req.body.atletaId          || actual.atleta_id;
            var categoria         = req.body.categoria         || actual.categoria;
            var sexo              = req.body.sexo              || actual.sexo;
            var municipio         = req.body.municipio         !== undefined ? req.body.municipio         : actual.municipio;
            var club              = req.body.club              !== undefined ? req.body.club              : actual.club;
            var anoCompetitivo    = req.body.añoCompetitivo    || actual.ano_competitivo;
            var pruebas           = req.body.pruebas           || actual.pruebas;
            var entrenadorId      = req.body.entrenadorId      !== undefined ? req.body.entrenadorId      : actual.entrenador_id;
            var lugarEntrenamiento = req.body.lugarEntrenamiento !== undefined ? req.body.lugarEntrenamiento : actual.lugar_entrenamiento;

            return pool.query(
                `UPDATE resultados SET
                 evento_id=$1, convocatoria_index=$2, atleta_id=$3, categoria=$4, sexo=$5,
                 municipio=$6, club=$7, ano_competitivo=$8, pruebas=$9, entrenador_id=$10,
                 lugar_entrenamiento=$11, fecha_actualizacion=NOW()
                 WHERE id=$12 RETURNING *`,
                [eventoId, convocatoriaIndex, atletaId, categoria, sexo,
                 municipio, club, anoCompetitivo, JSON.stringify(pruebas), entrenadorId,
                 lugarEntrenamiento, id]
            );
        })
        .then(function(r) {
            var row = r.rows[0];
            row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
            res.json(row);
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al actualizar resultado', error: err.message });
        });
}

// DELETE /api/resultados/:id
function eliminar(req, res) {
    pool.query('DELETE FROM resultados WHERE id = $1', [req.params.id])
        .then(function(r) {
            if (r.rowCount === 0) return res.status(404).json({ message: 'Resultado no encontrado' });
            res.json({ message: 'Resultado eliminado correctamente' });
        })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al eliminar resultado', error: err.message });
        });
}

// GET /api/resultados/evento/:eventoId
function porEvento(req, res) {
    pool.query('SELECT * FROM resultados WHERE evento_id = $1 ORDER BY fecha_registro DESC', [req.params.eventoId])
        .then(function(r) {
            res.json(r.rows.map(function(row) {
                row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
                return row;
            }));
        })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al obtener resultados del evento', error: err.message });
        });
}

// GET /api/resultados/atleta/:atletaId
function porAtleta(req, res) {
    pool.query('SELECT * FROM resultados WHERE atleta_id = $1 ORDER BY fecha_registro DESC', [req.params.atletaId])
        .then(function(r) {
            res.json(r.rows.map(function(row) {
                row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
                return row;
            }));
        })
        .catch(function(err) {
            res.status(500).json({ message: 'Error al obtener resultados del atleta', error: err.message });
        });
}

// GET /api/resultados/club/:clubId
function porClub(req, res) {
    var clubId = req.params.clubId;

    pool.query('SELECT id, nombre FROM clubes WHERE id = $1', [clubId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Club no encontrado' });
            var nombreClub = r.rows[0].nombre;
            return pool.query(
                'SELECT * FROM resultados WHERE club = $1 ORDER BY fecha_registro DESC',
                [nombreClub]
            );
        })
        .then(function(r) {
            res.json(r.rows.map(function(row) {
                row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
                return row;
            }));
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener resultados del club', error: err.message });
        });
}

// GET /api/resultados/entrenador/:entrenadorId
function porEntrenador(req, res) {
    var entrenadorId = req.params.entrenadorId;

    pool.query('SELECT u.id FROM usuarios u JOIN entrenadores e ON u.id = e.usuario_id WHERE u.id = $1', [entrenadorId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Entrenador no encontrado' });
            return pool.query('SELECT * FROM resultados WHERE entrenador_id = $1 ORDER BY fecha_registro DESC', [entrenadorId]);
        })
        .then(function(r) {
            res.json(r.rows.map(function(row) {
                row.pruebas = typeof row.pruebas === 'string' ? JSON.parse(row.pruebas) : (row.pruebas || []);
                return row;
            }));
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener resultados del entrenador', error: err.message });
        });
}

// GET /api/resultados/estadisticas/generales
function estadisticasGenerales(req, res) {
    pool.query(
        `SELECT
            COUNT(*) AS total_resultados,
            COUNT(DISTINCT evento_id) AS total_eventos,
            COUNT(DISTINCT atleta_id) AS total_atletas,
            COUNT(DISTINCT club) AS total_clubes,
            ARRAY_AGG(DISTINCT categoria) AS categorias
         FROM resultados`
    )
    .then(function(r) {
        res.json(r.rows[0] || {});
    })
    .catch(function(err) {
        res.status(500).json({ message: 'Error al obtener estadísticas', error: err.message });
    });
}

// GET /api/resultados/estadisticas/club/:clubId
function estadisticasClub(req, res) {
    pool.query('SELECT nombre FROM clubes WHERE id = $1', [req.params.clubId])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: 'Club no encontrado' });
            var nombreClub = r.rows[0].nombre;
            return pool.query(
                `SELECT
                    COUNT(*) AS total_resultados,
                    COUNT(DISTINCT atleta_id) AS total_atletas,
                    COUNT(DISTINCT evento_id) AS total_eventos,
                    ARRAY_AGG(DISTINCT categoria) AS categorias
                 FROM resultados WHERE club = $1`,
                [nombreClub]
            );
        })
        .then(function(r) { res.json(r.rows[0] || {}); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al obtener estadísticas del club', error: err.message });
        });
}

// GET /api/resultados/debug/clubes
function debugClubes(req, res) {
    Promise.all([
        pool.query('SELECT id, nombre FROM clubes'),
        pool.query('SELECT id, nombre_atleta, club FROM resultados')
    ])
    .then(function(results) {
        res.json({
            clubes: results[0].rows,
            resultados: results[1].rows,
            totalClubes: results[0].rows.length,
            totalResultados: results[1].rows.length
        });
    })
    .catch(function(err) {
        res.status(500).json({ message: 'Error en debug', error: err.message });
    });
}

module.exports = {
    crear, listar, obtener, actualizar, eliminar,
    porEvento, porAtleta, porClub, porEntrenador,
    estadisticasGenerales, estadisticasClub, debugClubes
};
