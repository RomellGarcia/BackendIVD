//src/models/entrenador.model.js
var pool = require('../config/db');

function obtenerPorEntrenadorId(entrenadorId) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS entrenador_estado
         FROM entrenadores e
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         WHERE e.id = $1`,
        [entrenadorId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerPorUsuarioId(usuarioId) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS entrenador_estado
         FROM entrenadores e
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         WHERE u.id = $1`,
        [usuarioId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerClubDelEntrenador(clubId) {
    return pool.query('SELECT * FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return r.rows[0] || null; });
}

function obtenerAtletasPorClub(clubId) {
    return pool.query(
        `SELECT u.*, a.id AS atleta_id, a.club_id, a.municipio
         FROM atletas a
         JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.club_id = $1`,
        [clubId]
    ).then(function(r) { return r.rows; });
}

function contarEventosProximos() {
    return pool.query("SELECT COUNT(*) AS total FROM eventos WHERE fecha >= NOW() AND estado = true")
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function obtenerEventosProximos(limite) {
    return pool.query(
        'SELECT * FROM eventos WHERE fecha >= NOW() AND estado = true ORDER BY fecha ASC LIMIT $1',
        [limite || 5]
    ).then(function(r) { return r.rows; });
}

function verificarClub(clubId) {
    return pool.query('SELECT * FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return r.rows[0] || null; });
}

function existeSolicitudActiva(entrenadorId, clubId) {
    return pool.query(
        "SELECT id FROM solicitudes_entrenadores WHERE entrenador_id = $1 AND club_id = $2 AND estado IN ('pendiente','aceptada')",
        [entrenadorId, clubId]
    ).then(function(r) { return r.rows[0] || null; });
}

function crearSolicitud(datos) {
    return pool.query(
        `INSERT INTO solicitudes_entrenadores (entrenador_id, club_id, mensaje, estado, fecha_solicitud)
         VALUES ($1, $2, $3, 'pendiente', NOW()) RETURNING *`,
        [datos.entrenadorId, datos.clubId, datos.mensaje]
    ).then(function(r) { return r.rows[0]; });
}

function obtenerSolicitudesPorEntrenador(entrenadorId) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores WHERE entrenador_id = $1 ORDER BY fecha_solicitud DESC',
        [entrenadorId]
    ).then(function(r) { return r.rows; });
}

function actualizarPerfil(entrenadorId, datos) {
    var camposU  = [];
    var paramsU  = [];
    var idxU     = 1;

    var mapaU = {
        nombre:     'nombre',
        apellidopa: 'apellido_paterno',
        apellidoma: 'apellido_materno',
        telefono:   'telefono',
        gmail:      'email'
    };

    Object.keys(mapaU).forEach(function(k) {
        if (datos[k] !== undefined) {
            camposU.push(mapaU[k] + ' = $' + idxU++);
            paramsU.push(datos[k]);
        }
    });

    var promesaU = Promise.resolve(null);
    if (camposU.length > 0) {
        promesaU = pool.query(
            'SELECT usuario_id FROM entrenadores WHERE id = $1', [entrenadorId]
        ).then(function(r) {
            if (!r.rows[0]) return null;
            var uid = r.rows[0].usuario_id;
            paramsU.push(uid);
            return pool.query(
                'UPDATE usuarios SET ' + camposU.join(', ') + ' WHERE id = $' + idxU + ' RETURNING *',
                paramsU
            ).then(function(r2) { return r2.rows[0]; });
        });
    }

    var promesaE = Promise.resolve(null);
    if (datos.añosExperiencia !== undefined || datos.estado !== undefined) {
        var camposE  = [];
        var paramsE  = [];
        var idxE     = 1;
        if (datos.añosExperiencia !== undefined) { camposE.push('anos_experiencia = $' + idxE++); paramsE.push(datos.añosExperiencia); }
        if (datos.estado !== undefined)           { camposE.push('estado = $'           + idxE++); paramsE.push(datos.estado); }
        paramsE.push(entrenadorId);
        promesaE = pool.query(
            'UPDATE entrenadores SET ' + camposE.join(', ') + ' WHERE id = $' + idxE + ' RETURNING *',
            paramsE
        );
    }

    return Promise.all([promesaU, promesaE]).then(function(res) { return res[0]; });
}

function obtenerTodosEntrenadores() {
    return pool.query(
        `SELECT u.*, e.id AS entrenador_id, e.club_id
         FROM entrenadores e JOIN usuarios u ON u.id = e.usuario_id`
    ).then(function(r) { return r.rows; });
}

function obtenerTodosAtletas() {
    return pool.query(
        `SELECT u.*, a.id AS atleta_id, a.club_id
         FROM atletas a JOIN usuarios u ON u.id = a.usuario_id`
    ).then(function(r) { return r.rows; });
}

function obtenerTodosClubes() {
    return pool.query('SELECT * FROM clubes').then(function(r) { return r.rows; });
}

module.exports = {
    obtenerPorEntrenadorId,
    obtenerPorUsuarioId,
    obtenerClubDelEntrenador,
    obtenerAtletasPorClub,
    contarEventosProximos,
    obtenerEventosProximos,
    verificarClub,
    existeSolicitudActiva,
    crearSolicitud,
    obtenerSolicitudesPorEntrenador,
    actualizarPerfil,
    obtenerTodosEntrenadores,
    obtenerTodosAtletas,
    obtenerTodosClubes
};