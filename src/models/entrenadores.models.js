// src/models/entrenadores.model.js
var pool = require('../config/db');

function verificarClub(clubId) {
    return pool.query(
        'SELECT id, nombre, email FROM clubes WHERE id = $1',
        [clubId]
    ).then(function(result) { return result.rows[0] || null; });
}

function obtenerEntrenadoresPorClub(clubId) {
    return pool.query(
        'SELECT * FROM registros WHERE club_id = $1 AND rol = $2 ORDER BY nombre ASC, apellidopa ASC',
        [clubId, 'entrenador']
    ).then(function(result) { return result.rows; });
}

function obtenerSolicitudesPorClub(clubId) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores WHERE club_id = $1 ORDER BY fecha_solicitud DESC',
        [clubId]
    ).then(function(result) { return result.rows; });
}

function obtenerSolicitudPorId(solicitudId) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores WHERE id = $1',
        [solicitudId]
    ).then(function(result) { return result.rows[0] || null; });
}

function actualizarEstadoSolicitud(solicitudId, estado) {
    return pool.query(
        'UPDATE solicitudes_entrenadores SET estado = $1 WHERE id = $2 RETURNING *',
        [estado, solicitudId]
    ).then(function(result) { return result.rows[0] || null; });
}

function asignarEntrenadorAClub(entrenadorId, clubId) {
    return pool.query(
        'UPDATE registros SET club_id = $1 WHERE id = $2 AND rol = $3 RETURNING id',
        [clubId, entrenadorId, 'entrenador']
    ).then(function(result) { return result.rows[0] || null; });
}

function obtenerTablas() {
    return pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    ).then(function(result) { return result.rows.map(function(r) { return r.table_name; }); });
}

function contarSolicitudes() {
    return pool.query('SELECT COUNT(*) AS total FROM solicitudes_entrenadores')
        .then(function(result) { return parseInt(result.rows[0].total, 10); });
}

function obtenerSolicitudesRecientes(limite) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores ORDER BY fecha_solicitud DESC LIMIT $1',
        [limite || 5]
    ).then(function(result) { return result.rows; });
}

module.exports = {
    verificarClub,
    obtenerEntrenadoresPorClub,
    obtenerSolicitudesPorClub,
    obtenerSolicitudPorId,
    actualizarEstadoSolicitud,
    asignarEntrenadorAClub,
    obtenerTablas,
    contarSolicitudes,
    obtenerSolicitudesRecientes
};