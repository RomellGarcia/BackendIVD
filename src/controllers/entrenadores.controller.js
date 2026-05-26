var pool = require('../config/db');

// GET /api/entrenadores/club/:clubId
function entrenadorespPorClub(req, res) {
    var clubId = req.params.clubId;

    pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            return pool.query(
                `SELECT u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
                        u.email, u.telefono, g.nombre AS sexo,
                        e.anos_experiencia, e.estado
                 FROM usuarios u
                 JOIN entrenadores e ON u.id = e.usuario_id
                 LEFT JOIN generos g ON u.genero_id = g.id
                 WHERE e.club_id = $1
                 ORDER BY u.nombre, u.apellido_paterno`,
                [clubId]
            );
        })
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('Error al obtener entrenadores del club:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

// GET /api/entrenadores/solicitudes-club/:clubId
function solicitudesPorClub(req, res) {
    var clubId = req.params.clubId;

    pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
            return pool.query(
                `SELECT se.id, se.estado, se.entrenador_id,
                        u.nombre, u.apellido_paterno, u.apellido_materno,
                        u.email, u.telefono
                 FROM solicitudes_entrenadores se
                 JOIN entrenadores e ON se.entrenador_id = e.id
                 JOIN usuarios u ON e.usuario_id = u.id
                 WHERE se.club_id = $1
                 ORDER BY se.id DESC`,
                [clubId]
            );
        })
        .then(function(result) { res.json(result.rows); })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('Error al obtener solicitudes:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

// PUT /api/entrenadores/solicitudes/:solicitudId
function procesarSolicitud(req, res) {
    var solicitudId = req.params.solicitudId;
    var estado      = req.body.estado;

    if (!['pendiente','aceptada','rechazada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
    }

    pool.query('SELECT * FROM solicitudes_entrenadores WHERE id = $1', [solicitudId])
        .then(function(result) {
            if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Solicitud no encontrada' });
            var solicitud = result.rows[0];

            var promesas = [
                pool.query('UPDATE solicitudes_entrenadores SET estado = $1 WHERE id = $2', [estado, solicitudId])
            ];

            if (estado === 'aceptada') {
                promesas.push(pool.query(
                    'UPDATE entrenadores SET club_id = $1 WHERE id = $2',
                    [solicitud.club_id, solicitud.entrenador_id]
                ));
            }
            return Promise.all(promesas);
        })
        .then(function() {
            res.json({ message: 'Solicitud actualizada correctamente' });
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            console.error('Error al actualizar solicitud:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

module.exports = { entrenadorespPorClub, solicitudesPorClub, procesarSolicitud };
