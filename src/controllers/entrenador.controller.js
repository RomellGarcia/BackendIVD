var pool = require('../config/db');

// GET /api/entrenador/stats/:id
function stats(req, res) {
    var entrenadorId = req.params.id;

    pool.query(
        `SELECT e.id, e.club_id, u.nombre FROM entrenadores e
         JOIN usuarios u ON e.usuario_id = u.id WHERE u.id = $1`,
        [entrenadorId]
    )
    .then(function(result) {
        if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Entrenador no encontrado' });
        var entrenador = result.rows[0];

        var promesas = [
            entrenador.club_id
                ? pool.query('SELECT COUNT(*) FROM atletas WHERE club_id = $1', [entrenador.club_id])
                : Promise.resolve({ rows: [{ count: 0 }] }),
            pool.query('SELECT COUNT(*) FROM eventos WHERE fecha >= NOW()')
        ];
        return Promise.all(promesas);
    })
    .then(function(results) {
        res.json({
            totalAtletas:      parseInt(results[0].rows[0].count),
            atletasActivos:    parseInt(results[0].rows[0].count),
            eventosProximos:   parseInt(results[1].rows[0].count),
            sesionesEsteMes:   0
        });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ error: err.error });
        console.error('Error al obtener estadísticas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

// GET /api/entrenador/activity/:id
function activity(req, res) {
    pool.query(
        'SELECT id, nombre, lugar, fecha FROM eventos WHERE fecha >= NOW() ORDER BY fecha ASC LIMIT 5'
    )
    .then(function(result) {
        var actividad = result.rows.map(function(evento) {
            return {
                tipo:        'evento',
                titulo:      evento.nombre,
                descripcion: 'Evento: ' + evento.nombre + ' - ' + evento.lugar,
                fecha:       evento.fecha
            };
        });
        res.json(actividad);
    })
    .catch(function(err) {
        console.error('Error al obtener actividad:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

// GET /api/entrenador/atletas/:id
function atletasDelEntrenador(req, res) {
    var entrenadorId = req.params.id;

    pool.query(
        'SELECT e.club_id FROM entrenadores e WHERE e.usuario_id = $1',
        [entrenadorId]
    )
    .then(function(result) {
        if (result.rows.length === 0) return Promise.reject({ status: 404, error: 'Entrenador no encontrado' });
        var clubId = result.rows[0].club_id;
        if (!clubId) return res.json([]);

        return pool.query(
            `SELECT u.id, u.nombre, u.apellido_paterno, u.apellido_materno,
                    u.fecha_nacimiento, u.email, u.telefono, u.curp,
                    g.nombre AS sexo, a.club_id,
                    DATE_PART('year', AGE(u.fecha_nacimiento::date)) AS edad
             FROM usuarios u
             JOIN atletas a ON u.id = a.usuario_id
             LEFT JOIN generos g ON u.genero_id = g.id
             WHERE a.club_id = $1`,
            [clubId]
        ).then(function(r) { res.json(r.rows); });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ error: err.error });
        console.error('Error al obtener atletas:', err);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    });
}

// POST /api/entrenador/solicitar-club
function solicitarClub(req, res) {
    var entrenadorId = req.body.entrenadorId;
    var clubId       = req.body.clubId;
    var mensaje      = req.body.mensaje;

    Promise.all([
        pool.query('SELECT e.id, u.nombre, u.apellido_paterno, u.email, u.telefono FROM entrenadores e JOIN usuarios u ON e.usuario_id = u.id WHERE u.id = $1', [entrenadorId]),
        pool.query('SELECT id, nombre FROM clubes WHERE id = $1', [clubId])
    ])
    .then(function(results) {
        if (results[0].rows.length === 0) return Promise.reject({ status: 404, error: 'Entrenador no encontrado' });
        if (results[1].rows.length === 0) return Promise.reject({ status: 404, error: 'Club no encontrado' });
        var entrenador = results[0].rows[0];

        return pool.query(
            `SELECT id FROM solicitudes_entrenadores
             WHERE entrenador_id = $1 AND club_id = $2 AND estado IN ('pendiente','aceptada')`,
            [entrenador.id, clubId]
        ).then(function(r) {
            if (r.rows.length > 0) return Promise.reject({ status: 400, error: 'Ya tienes una solicitud activa para este club' });
            return pool.query(
                `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, estado)
                 VALUES ($1,$2,'pendiente') RETURNING id`,
                [entrenador.id, clubId]
            );
        }).then(function(r) {
            res.json({ message: 'Solicitud enviada correctamente', solicitudId: r.rows[0].id });
        });
    })
    .catch(function(err) {
        if (err.status) return res.status(err.status).json({ error: err.error });
        console.error('Error al enviar solicitud:', err);
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    });
}

// GET /api/entrenador/solicitudes/:id
function solicitudesEntrenador(req, res) {
    pool.query(
        `SELECT se.*, c.nombre AS nombre_club
         FROM solicitudes_entrenadores se
         JOIN entrenadores e ON se.entrenador_id = e.id
         JOIN clubes c ON se.club_id = c.id
         WHERE e.usuario_id = $1
         ORDER BY se.id DESC`,
        [req.params.id]
    )
    .then(function(result) { res.json(result.rows); })
    .catch(function(err) {
        console.error('Error al obtener solicitudes:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

// GET /api/entrenador/perfil/:id
function perfil(req, res) {
    pool.query(
        `SELECT u.*, g.nombre AS sexo, r.nombre AS rol_nombre,
                e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS estado_entrenador,
                json_agg(DISTINCT cert.nombre) FILTER (WHERE cert.nombre IS NOT NULL) AS certificaciones,
                json_agg(DISTINCT esp.nombre)  FILTER (WHERE esp.nombre IS NOT NULL)  AS especialidades
         FROM usuarios u
         LEFT JOIN generos g ON u.genero_id = g.id
         LEFT JOIN roles r ON u.rol_id = r.id
         LEFT JOIN entrenadores e ON u.id = e.usuario_id
         LEFT JOIN certificaciones cert ON e.id = cert.entrenador_id
         LEFT JOIN especialidades esp ON e.id = esp.entrenador_id
         WHERE u.id = $1
         GROUP BY u.id, g.nombre, r.nombre, e.id, e.club_id, e.anos_experiencia, e.estado`,
        [req.params.id]
    )
    .then(function(result) {
        if (result.rows.length === 0) return res.status(404).json({ error: 'Entrenador no encontrado' });
        var entrenador = result.rows[0];
        var clubPromesa = entrenador.club_id
            ? pool.query('SELECT id, nombre, email FROM clubes WHERE id = $1', [entrenador.club_id])
            : Promise.resolve({ rows: [null] });
        return clubPromesa.then(function(r) {
            res.json({ entrenador: entrenador, club: r.rows[0] || null });
        });
    })
    .catch(function(err) {
        console.error('Error al obtener perfil:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

// PUT /api/entrenador/perfil/:id
function actualizarPerfil(req, res) {
    var id = req.params.id;
    var campos = ['nombre','apellido_paterno','apellido_materno','telefono','email'];
    var sets = [];
    var params = [];

    var mapeo = {
        nombre: 'nombre', apellidopa: 'apellido_paterno',
        apellidoma: 'apellido_materno', telefono: 'telefono', gmail: 'email'
    };

    Object.keys(mapeo).forEach(function(bodyKey) {
        if (req.body[bodyKey] !== undefined) {
            params.push(req.body[bodyKey]);
            sets.push(mapeo[bodyKey] + ' = $' + params.length);
        }
    });

    var promesas = [];

    if (sets.length > 0) {
        params.push(id);
        promesas.push(pool.query('UPDATE usuarios SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params));
    }

    // Actualizar años de experiencia y estado en tabla entrenadores
    if (req.body.añosExperiencia !== undefined || req.body.estado !== undefined) {
        var eSets = [];
        var eParams = [];
        if (req.body.añosExperiencia !== undefined) { eParams.push(req.body.añosExperiencia); eSets.push('anos_experiencia = $' + eParams.length); }
        if (req.body.estado !== undefined)           { eParams.push(req.body.estado);           eSets.push('estado = $' + eParams.length); }
        eParams.push(id);
        promesas.push(pool.query('UPDATE entrenadores SET ' + eSets.join(', ') + ' WHERE usuario_id = $' + eParams.length, eParams));
    }

    Promise.all(promesas)
        .then(function() {
            res.json({ success: true, message: 'Perfil actualizado correctamente' });
        })
        .catch(function(err) {
            console.error('Error al actualizar perfil:', err);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

// GET /api/entrenador/verificar-estructura (debug - mantener para compatibilidad)
function verificarEstructura(req, res) {
    Promise.all([
        pool.query(`SELECT COUNT(*) FROM entrenadores`),
        pool.query(`SELECT COUNT(*) FROM atletas`),
        pool.query(`SELECT COUNT(*) FROM clubes`),
        pool.query(`SELECT COUNT(*) FROM entrenadores WHERE club_id IS NOT NULL`),
        pool.query(`SELECT COUNT(*) FROM atletas WHERE club_id IS NOT NULL`)
    ])
    .then(function(results) {
        res.json({
            totalEntrenadores:    parseInt(results[0].rows[0].count),
            totalAtletas:         parseInt(results[1].rows[0].count),
            totalClubes:          parseInt(results[2].rows[0].count),
            entrenadoresConClub:  parseInt(results[3].rows[0].count),
            atletasConClub:       parseInt(results[4].rows[0].count)
        });
    })
    .catch(function(err) {
        res.status(500).json({ error: 'Error interno del servidor', details: err.message });
    });
}

module.exports = { stats, activity, atletasDelEntrenador, solicitarClub, solicitudesEntrenador, perfil, actualizarPerfil, verificarEstructura };
