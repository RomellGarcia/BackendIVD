// controllers/contenidoEstatico.controller.js
// Maneja: mision, vision, terminos, politicas
// Patrón: un solo documento por tipo (deleteMany + insertOne al crear, upsert al actualizar)

var pool = require('../config/db');

// GET /api/:tipo — obtener todos los registros del tipo
function listar(req, res) {
    var tipo = req.baseUrl.replace('/api/', '');
    pool.query(
        'SELECT * FROM contenido_estatico WHERE tipo = $1 ORDER BY updated_at DESC',
        [tipo]
    )
    .then(function(r) { res.json(r.rows); })
    .catch(function(err) {
        console.error('❌ Error al obtener ' + tipo + ':', err);
        res.status(500).json({ message: 'Error al obtener ' + tipo, error: err.message });
    });
}

// GET /api/:tipo/:id — obtener por id
function obtenerPorId(req, res) {
    var tipo = req.baseUrl.replace('/api/', '');
    pool.query(
        'SELECT * FROM contenido_estatico WHERE tipo = $1 AND id = $2',
        [tipo, req.params.id]
    )
    .then(function(r) {
        if (r.rows.length === 0) return res.status(404).json({ message: tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' no encontrado' });
        res.json(r.rows[0]);
    })
    .catch(function(err) {
        res.status(500).json({ message: 'Error al obtener ' + tipo, error: err.message });
    });
}

// POST /api/:tipo — crear (elimina todos los anteriores primero, igual que el original)
function crear(req, res) {
    var tipo     = req.baseUrl.replace('/api/', '');
    var titulo   = req.body.titulo;
    var contenido = req.body.contenido;

    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
        return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }

    // Eliminar todos los existentes del tipo y luego insertar (comportamiento original)
    pool.query('DELETE FROM contenido_estatico WHERE tipo = $1', [tipo])
        .then(function() {
            return pool.query(
                'INSERT INTO contenido_estatico (tipo, titulo, contenido, updated_at) VALUES ($1,$2,$3,NOW()) RETURNING *',
                [tipo, titulo.trim(), contenido.trim()]
            );
        })
        .then(function(r) {
            res.status(201).json(r.rows[0]);
        })
        .catch(function(err) {
            console.error('❌ Error al crear ' + tipo + ':', err);
            res.status(500).json({ message: 'Error al crear ' + tipo, error: err.message });
        });
}

// PUT /api/:tipo/:id — actualizar por id
function actualizar(req, res) {
    var tipo     = req.baseUrl.replace('/api/', '');
    var titulo   = req.body.titulo;
    var contenido = req.body.contenido;

    if (!titulo || !contenido) {
        return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
        return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }

    pool.query('SELECT id FROM contenido_estatico WHERE tipo = $1 AND id = $2', [tipo, req.params.id])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' no encontrado' });
            return pool.query(
                'UPDATE contenido_estatico SET titulo=$1, contenido=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
                [titulo.trim(), contenido.trim(), req.params.id]
            );
        })
        .then(function(r) { res.json(r.rows[0]); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al actualizar ' + tipo, error: err.message });
        });
}

// DELETE /api/:tipo/:id — eliminar por id
function eliminar(req, res) {
    var tipo = req.baseUrl.replace('/api/', '');

    pool.query('SELECT id FROM contenido_estatico WHERE tipo = $1 AND id = $2', [tipo, req.params.id])
        .then(function(r) {
            if (r.rows.length === 0) return Promise.reject({ status: 404, message: tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' no encontrado' });
            return pool.query('DELETE FROM contenido_estatico WHERE id = $1', [req.params.id]);
        })
        .then(function() {
            res.json({ message: tipo.charAt(0).toUpperCase() + tipo.slice(1) + ' eliminado correctamente' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ message: err.message });
            res.status(500).json({ message: 'Error al eliminar ' + tipo, error: err.message });
        });
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
