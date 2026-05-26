// controllers/sesiones.controller.js
var pool = require('../config/db');

// POST /api/sesiones/crear
function crear(req, res) {
    var titulo            = req.body.titulo;
    var descripcion       = req.body.descripcion       || '';
    var fechaInicio       = req.body.fechaInicio;
    var duracion          = parseInt(req.body.duracion) || 0;
    var tipoEntrenamiento = req.body.tipoEntrenamiento || '';
    var ejercicios        = req.body.ejercicios        || [];
    var intensidad        = req.body.intensidad        || '';
    var materialNecesario = req.body.materialNecesario || [];
    var notas             = req.body.notas             || '';
    var entrenadorId      = req.body.entrenadorId;
    var clubId            = req.body.clubId;
    var atletasAsignados  = req.body.atletasAsignados  || [];

    pool.query(
        `INSERT INTO sesiones
         (titulo, descripcion, fecha_inicio, duracion, tipo_entrenamiento,
          ejercicios, intensidad, material_necesario, notas,
          entrenador_id, club_id, atletas_asignados, estado,
          fecha_creacion, fecha_actualizacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'programada',NOW(),NOW())
         RETURNING id`,
        [
            titulo, descripcion, new Date(fechaInicio), duracion, tipoEntrenamiento,
            JSON.stringify(ejercicios), intensidad, JSON.stringify(materialNecesario),
            notas, entrenadorId || null, clubId || null, JSON.stringify(atletasAsignados)
        ]
    )
    .then(function(r) {
        res.status(201).json({
            success: true,
            message: 'Sesión creada exitosamente',
            sesionId: r.rows[0].id
        });
    })
    .catch(function(err) {
        console.error('Error al crear sesión:', err);
        res.status(500).json({ success: false, message: 'Error al crear la sesión', error: err.message });
    });
}

// Helper para parsear campos JSON de una sesión
function parseSesion(row) {
    if (!row) return row;
    row.ejercicios       = typeof row.ejercicios       === 'string' ? JSON.parse(row.ejercicios)        : (row.ejercicios       || []);
    row.material_necesario = typeof row.material_necesario === 'string' ? JSON.parse(row.material_necesario) : (row.material_necesario || []);
    row.atletas_asignados  = typeof row.atletas_asignados  === 'string' ? JSON.parse(row.atletas_asignados)  : (row.atletas_asignados  || []);
    return row;
}

// GET /api/sesiones/entrenador/:entrenadorId
function porEntrenador(req, res) {
    pool.query(
        'SELECT * FROM sesiones WHERE entrenador_id = $1 ORDER BY fecha_inicio ASC',
        [req.params.entrenadorId]
    )
    .then(function(r) {
        res.json({ success: true, sesiones: r.rows.map(parseSesion) });
    })
    .catch(function(err) {
        console.error('Error al obtener sesiones:', err);
        res.status(500).json({ success: false, message: 'Error al obtener las sesiones', error: err.message });
    });
}

// GET /api/sesiones/club/:clubId
function porClub(req, res) {
    pool.query(
        'SELECT * FROM sesiones WHERE club_id = $1 ORDER BY fecha_inicio ASC',
        [req.params.clubId]
    )
    .then(function(r) {
        res.json({ success: true, sesiones: r.rows.map(parseSesion) });
    })
    .catch(function(err) {
        console.error('Error al obtener sesiones del club:', err);
        res.status(500).json({ success: false, message: 'Error al obtener las sesiones del club', error: err.message });
    });
}

// GET /api/sesiones/atleta/:atletaId
// En PostgreSQL buscamos el atletaId dentro del array JSONB
function porAtleta(req, res) {
    pool.query(
        `SELECT * FROM sesiones
         WHERE atletas_asignados @> $1::jsonb
         ORDER BY fecha_inicio ASC`,
        [JSON.stringify([parseInt(req.params.atletaId) || req.params.atletaId])]
    )
    .then(function(r) {
        res.json({ success: true, sesiones: r.rows.map(parseSesion) });
    })
    .catch(function(err) {
        console.error('Error al obtener sesiones del atleta:', err);
        res.status(500).json({ success: false, message: 'Error al obtener las sesiones del atleta', error: err.message });
    });
}

// GET /api/sesiones/:sesionId
function obtener(req, res) {
    pool.query('SELECT * FROM sesiones WHERE id = $1', [req.params.sesionId])
        .then(function(r) {
            if (r.rows.length === 0) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
            res.json({ success: true, sesion: parseSesion(r.rows[0]) });
        })
        .catch(function(err) {
            console.error('Error al obtener sesión:', err);
            res.status(500).json({ success: false, message: 'Error al obtener la sesión', error: err.message });
        });
}

// PUT /api/sesiones/:sesionId
function actualizar(req, res) {
    var id     = req.params.sesionId;
    var body   = req.body;
    var sets   = ['fecha_actualizacion = NOW()'];
    var params = [];

    var mapeo = {
        titulo:            'titulo',
        descripcion:       'descripcion',
        fechaInicio:       'fecha_inicio',
        duracion:          'duracion',
        tipoEntrenamiento: 'tipo_entrenamiento',
        intensidad:        'intensidad',
        notas:             'notas',
        estado:            'estado',
        entrenadorId:      'entrenador_id',
        clubId:            'club_id'
    };

    Object.keys(mapeo).forEach(function(key) {
        if (body[key] !== undefined) {
            params.push(key === 'fechaInicio' ? new Date(body[key]) : body[key]);
            sets.push(mapeo[key] + ' = $' + params.length);
        }
    });

    // Arrays como JSONB
    if (body.ejercicios !== undefined) {
        params.push(JSON.stringify(body.ejercicios));
        sets.push('ejercicios = $' + params.length);
    }
    if (body.materialNecesario !== undefined) {
        params.push(JSON.stringify(body.materialNecesario));
        sets.push('material_necesario = $' + params.length);
    }
    if (body.atletasAsignados !== undefined) {
        params.push(JSON.stringify(body.atletasAsignados));
        sets.push('atletas_asignados = $' + params.length);
    }

    params.push(id);
    pool.query(
        'UPDATE sesiones SET ' + sets.join(', ') + ' WHERE id = $' + params.length,
        params
    )
    .then(function(r) {
        if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
        res.json({ success: true, message: 'Sesión actualizada exitosamente' });
    })
    .catch(function(err) {
        console.error('Error al actualizar sesión:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar la sesión', error: err.message });
    });
}

// DELETE /api/sesiones/:sesionId
function eliminar(req, res) {
    pool.query('DELETE FROM sesiones WHERE id = $1', [req.params.sesionId])
        .then(function(r) {
            if (r.rowCount === 0) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
            res.json({ success: true, message: 'Sesión eliminada exitosamente' });
        })
        .catch(function(err) {
            console.error('Error al eliminar sesión:', err);
            res.status(500).json({ success: false, message: 'Error al eliminar la sesión', error: err.message });
        });
}

module.exports = { crear, porEntrenador, porClub, porAtleta, obtener, actualizar, eliminar };
