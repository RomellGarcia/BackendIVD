// src/models/entrenadores.model.js
var pool = require('../config/db');

function verificarClub(clubId) {
    return pool.query('SELECT id, nombre, email FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return r.rows[0] || null; });
}

function obtenerEntrenadoresPorClub(clubId) {
    return pool.query(
        `SELECT u.*, e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS entrenador_estado
         FROM entrenadores e
         JOIN usuarios u ON u.id = e.usuario_id
         WHERE e.club_id = $1
         ORDER BY u.nombre ASC`,
        [clubId]
    ).then(function(r) { return r.rows; });
}

function obtenerSolicitudesPorClub(clubId) {
    return pool.query(
        `SELECT se.*, u.nombre, u.apellido_paterno, u.email, u.telefono
         FROM solicitudes_entrenadores se
         JOIN entrenadores e ON e.id = se.entrenador_id
         JOIN usuarios u ON u.id = e.usuario_id
         WHERE se.club_id = $1
         ORDER BY se.fecha_solicitud DESC`,
        [clubId]
    ).then(function(r) { return r.rows; });
}

function obtenerSolicitudPorId(solicitudId) {
    return pool.query('SELECT * FROM solicitudes_entrenadores WHERE id = $1', [solicitudId])
        .then(function(r) { return r.rows[0] || null; });
}

function actualizarEstadoSolicitud(solicitudId, estado) {
    return pool.query(
        'UPDATE solicitudes_entrenadores SET estado = $1 WHERE id = $2 RETURNING *',
        [estado, solicitudId]
    ).then(function(r) { return r.rows[0] || null; });
}

function asignarEntrenadorAClub(entrenadorId, clubId) {
    return pool.query(
        'UPDATE entrenadores SET club_id = $1 WHERE id = $2 RETURNING id',
        [clubId, entrenadorId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerTablas() {
    return pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    ).then(function(r) { return r.rows.map(function(row) { return row.table_name; }); });
}

function contarSolicitudes() {
    return pool.query('SELECT COUNT(*) AS total FROM solicitudes_entrenadores')
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function obtenerSolicitudesRecientes(limite) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores ORDER BY fecha_solicitud DESC LIMIT $1',
        [limite || 5]
    ).then(function(r) { return r.rows; });
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
