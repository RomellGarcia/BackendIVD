// src/models/entrenador.model.js
var pool = require('../config/db');

function obtenerPorId(id) {
    return pool.query(
        'SELECT * FROM registros WHERE id = $1 AND rol = $2',
        [id, 'entrenador']
    ).then(function(result) { return result.rows[0] || null; });
}

function obtenerClubDelEntrenador(clubId) {
    return pool.query(
        'SELECT * FROM clubes WHERE id = $1',
        [clubId]
    ).then(function(result) { return result.rows[0] || null; });
}

function obtenerAtletasPorClub(clubId) {
    return pool.query(
        'SELECT * FROM registros WHERE club_id = $1 AND rol = $2',
        [clubId, 'atleta']
    ).then(function(result) { return result.rows; });
}

function contarEventosProximos() {
    return pool.query(
        'SELECT COUNT(*) AS total FROM eventos WHERE fecha >= NOW()'
    ).then(function(result) { return parseInt(result.rows[0].total, 10); });
}

function obtenerEventosProximos(limite) {
    return pool.query(
        'SELECT * FROM eventos WHERE fecha >= NOW() ORDER BY fecha ASC LIMIT $1',
        [limite || 5]
    ).then(function(result) { return result.rows; });
}

function verificarClub(clubId) {
    return pool.query(
        'SELECT * FROM clubes WHERE id = $1',
        [clubId]
    ).then(function(result) { return result.rows[0] || null; });
}

function existeSolicitudActiva(entrenadorId, clubId) {
    return pool.query(
        "SELECT id FROM solicitudes_entrenadores WHERE entrenador_id = $1 AND club_id = $2 AND estado IN ('pendiente', 'aceptada')",
        [entrenadorId, clubId]
    ).then(function(result) { return result.rows[0] || null; });
}

function crearSolicitud(datos) {
    return pool.query(
        `INSERT INTO solicitudes_entrenadores
            (entrenador_id, club_id, mensaje, estado, nombre_entrenador, email_entrenador, telefono_entrenador, fecha_solicitud)
         VALUES ($1, $2, $3, 'pendiente', $4, $5, $6, NOW())
         RETURNING *`,
        [
            datos.entrenadorId,
            datos.clubId,
            datos.mensaje,
            datos.nombreEntrenador,
            datos.emailEntrenador,
            datos.telefonoEntrenador
        ]
    ).then(function(result) { return result.rows[0]; });
}

function obtenerSolicitudesPorEntrenador(entrenadorId) {
    return pool.query(
        'SELECT * FROM solicitudes_entrenadores WHERE entrenador_id = $1 ORDER BY fecha_solicitud DESC',
        [entrenadorId]
    ).then(function(result) { return result.rows; });
}

function actualizarPerfil(id, datos) {
    // Construir SET dinámico solo con los campos que vienen
    var campos  = [];
    var valores = [];
    var idx     = 1;

    var permitidos = [
        'nombre', 'apellidopa', 'apellidoma', 'telefono', 'gmail',
        'certificaciones', 'especialidades', 'anos_experiencia', 'estado'
    ];

    // Mapeo de nombres del body a columnas de la tabla
    var mapaColumnas = {
        nombre:           'nombre',
        apellidopa:       'apellidopa',
        apellidoma:       'apellidoma',
        telefono:         'telefono',
        gmail:            'gmail',
        certificaciones:  'certificaciones',
        especialidades:   'especialidades',
        añosExperiencia:  'anos_experiencia',
        estado:           'estado'
    };

    Object.keys(mapaColumnas).forEach(function(campo) {
        if (datos[campo] !== undefined) {
            campos.push(mapaColumnas[campo] + ' = $' + idx);
            valores.push(datos[campo]);
            idx++;
        }
    });

    if (campos.length === 0) return Promise.resolve(null);

    valores.push(id);

    return pool.query(
        'UPDATE registros SET ' + campos.join(', ') + ' WHERE id = $' + idx + ' AND rol = $' + (idx + 1) + ' RETURNING *',
        valores.concat(['entrenador'])
    ).then(function(result) { return result.rows[0] || null; });
}

// ── Para el endpoint de debug/verificar-estructura ───────────────────────────

function obtenerTodosEntrenadores() {
    return pool.query(
        'SELECT * FROM registros WHERE rol = $1',
        ['entrenador']
    ).then(function(result) { return result.rows; });
}

function obtenerTodosAtletas() {
    return pool.query(
        'SELECT * FROM registros WHERE rol = $1',
        ['atleta']
    ).then(function(result) { return result.rows; });
}

function obtenerTodosClubes() {
    return pool.query('SELECT * FROM clubes')
        .then(function(result) { return result.rows; });
}

module.exports = {
    obtenerPorId,
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