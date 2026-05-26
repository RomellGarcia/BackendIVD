var pool   = require('../config/db');
var bcrypt = require('bcrypt');
var saltRounds = 10;

// GET /api/clubes
function listarClubes(req, res) {
    pool.query('SELECT id, nombre, direccion, telefono, email, descripcion, estado, fecha_creacion FROM clubes ORDER BY nombre')
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            console.error('❌ Error al obtener clubes:', err);
            res.status(500).json({ error: 'Error al obtener clubes', details: err.message });
        });
}

// POST /api/clubes
function crearClub(req, res) {
    var nombre      = req.body.nombre;
    var direccion   = req.body.direccion;
    var telefono    = req.body.telefono;
    var email       = req.body.email || '';
    var entrenador  = req.body.entrenador || '';
    var descripcion = req.body.descripcion || '';
    var estado      = req.body.estado || 'activo';
    var password    = req.body.password;

    if (!nombre || !direccion || !telefono || !password) {
        return res.status(400).json({ error: 'Nombre, dirección, teléfono y contraseña son obligatorios' });
    }

    var telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    pool.query('SELECT id FROM clubes WHERE nombre = $1', [nombre.trim()])
        .then(function(result) {
            if (result.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya existe un club con ese nombre' });
            if (!email) return null;
            return pool.query('SELECT id FROM clubes WHERE email = $1', [email.trim()]);
        })
        .then(function(result) {
            if (result && result.rows.length > 0) return Promise.reject({ status: 400, error: 'El email ya está registrado' });
            return bcrypt.hash(password, saltRounds);
        })
        .then(function(hash) {
            return pool.query(
                `INSERT INTO clubes (nombre, direccion, telefono, email, descripcion, password, estado, fecha_creacion, fecha_actualizacion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING id, nombre, direccion, telefono, email, descripcion, estado`,
                [nombre.trim(), direccion.trim(), telefonoLimpio, email.trim(), descripcion.trim(), hash, estado]
            );
        })
        .then(function(result) {
            res.status(201).json(result.rows[0]);
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al crear club:', err);
            res.status(500).json({ error: 'No se pudo crear el club', details: err.message });
        });
}

// GET /api/clubes/:id
function obtenerClub(req, res) {
    pool.query('SELECT id, nombre, direccion, telefono, email, descripcion, estado FROM clubes WHERE id = $1', [req.params.id])
        .then(function(result) {
            if (result.rows.length === 0) return res.status(404).json({ error: 'Club no encontrado' });
            res.json(result.rows[0]);
        })
        .catch(function(err) {
            console.error('❌ Error al obtener club:', err);
            res.status(500).json({ error: 'Error al obtener club', details: err.message });
        });
}

// PUT /api/clubes/:id
function actualizarClub(req, res) {
    var nombre      = req.body.nombre;
    var direccion   = req.body.direccion;
    var telefono    = req.body.telefono;
    var email       = req.body.email;
    var descripcion = req.body.descripcion;
    var estado      = req.body.estado;

    if (!nombre || !direccion || !telefono) {
        return res.status(400).json({ error: 'Nombre, dirección y teléfono son obligatorios' });
    }

    var telefonoLimpio = telefono.replace(/\D/g, '');
    if (telefonoLimpio.length !== 10) {
        return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos' });
    }

    var id = req.params.id;

    pool.query('SELECT id, estado FROM clubes WHERE id = $1', [id])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            var clubActual = result.rows[0];
            // Verificar nombre duplicado excluyendo el actual
            return pool.query('SELECT id FROM clubes WHERE nombre = $1 AND id != $2', [nombre.trim(), id])
                .then(function(r) {
                    if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya existe otro club con ese nombre' });
                    if (!email) return clubActual;
                    return pool.query('SELECT id FROM clubes WHERE email = $1 AND id != $2', [email.trim(), id])
                        .then(function(r2) {
                            if (r2.rows.length > 0) return Promise.reject({ status: 400, error: 'El email ya está registrado por otro club' });
                            return clubActual;
                        });
                });
        })
        .then(function(clubActual) {
            return pool.query(
                `UPDATE clubes SET nombre=$1, direccion=$2, telefono=$3, email=$4, descripcion=$5, estado=$6, fecha_actualizacion=NOW()
                 WHERE id=$7
                 RETURNING id, nombre, direccion, telefono, email, descripcion, estado`,
                [nombre.trim(), direccion.trim(), telefonoLimpio, email ? email.trim() : '', descripcion ? descripcion.trim() : '', estado || clubActual.estado, id]
            );
        })
        .then(function(result) {
            res.json(result.rows[0]);
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al actualizar club:', err);
            res.status(500).json({ error: 'Error al actualizar club', details: err.message });
        });
}

// DELETE /api/clubes/:id
function eliminarClub(req, res) {
    var id = req.params.id;

    pool.query('SELECT id FROM clubes WHERE id = $1', [id])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            return pool.query('SELECT id FROM atletas WHERE club_id = $1 LIMIT 1', [id]);
        })
        .then(function(result) {
            if (result.rows.length > 0) return Promise.reject({ status: 400, error: 'No se puede eliminar el club porque tiene atletas asociados. Primero desasocia todos los atletas.' });
            return pool.query('DELETE FROM clubes WHERE id = $1', [id]);
        })
        .then(function() {
            res.json({ message: 'Club eliminado correctamente' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al eliminar club:', err);
            res.status(500).json({ error: 'Error al eliminar club', details: err.message });
        });
}

// GET /api/clubes/estadisticas/generales
function estadisticas(req, res) {
    Promise.all([
        pool.query('SELECT COUNT(*) FROM clubes'),
        pool.query("SELECT COUNT(*) FROM clubes WHERE estado = 'activo'"),
        pool.query("SELECT COUNT(*) FROM clubes WHERE estado = 'inactivo'"),
        pool.query(
            `SELECT c.nombre AS nombre_club, COUNT(a.id) AS total_atletas
             FROM clubes c
             LEFT JOIN atletas a ON c.id = a.club_id
             GROUP BY c.id, c.nombre
             ORDER BY total_atletas DESC`
        )
    ])
    .then(function(results) {
        res.json({
            totalClubes:     parseInt(results[0].rows[0].count),
            clubesActivos:   parseInt(results[1].rows[0].count),
            clubesInactivos: parseInt(results[2].rows[0].count),
            atletasPorClub:  results[3].rows
        });
    })
    .catch(function(err) {
        console.error('❌ Error al obtener estadísticas:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas', details: err.message });
    });
}

// POST /api/clubes/:id/atletas — Asociar múltiples atletas a un club
function asociarAtletas(req, res) {
    var atletaIds = req.body.atletaIds;
    var clubId    = req.params.id;

    if (!atletaIds || !Array.isArray(atletaIds)) {
        return res.status(400).json({ error: 'Se requiere un array de IDs de atletas' });
    }

    pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            // Actualizar todos los atletas de la lista
            var promesas = atletaIds.map(function(atletaId) {
                return pool.query('UPDATE atletas SET club_id = $1 WHERE usuario_id = $2', [clubId, atletaId]);
            });
            return Promise.all(promesas);
        })
        .then(function(results) {
            var modificados = results.reduce(function(acc, r) { return acc + r.rowCount; }, 0);
            res.json({ message: modificados + ' atletas asociados correctamente al club', atletasAsociados: modificados });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al asociar atletas:', err);
            res.status(500).json({ error: 'Error al asociar atletas', details: err.message });
        });
}

// DELETE /api/clubes/:id/atletas/:atletaId — Desasociar un atleta del club
function desasociarAtleta(req, res) {
    var clubId   = req.params.id;
    var atletaId = req.params.atletaId;

    pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            return pool.query('SELECT id FROM atletas WHERE usuario_id = $1 AND club_id = $2', [atletaId, clubId]);
        })
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Atleta no encontrado o no está asociado a este club' });
            return pool.query('UPDATE atletas SET club_id = NULL WHERE usuario_id = $1', [atletaId]);
        })
        .then(function() {
            res.json({ message: 'Atleta desasociado correctamente del club' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('❌ Error al desasociar atleta:', err);
            res.status(500).json({ error: 'Error al desasociar atleta', details: err.message });
        });
}

module.exports = { listarClubes, crearClub, obtenerClub, actualizarClub, eliminarClub, estadisticas, asociarAtletas, desasociarAtleta };
