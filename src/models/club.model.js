// src/models/club.model.js
// clubes NO tiene password en el schema real (backup.sql)
// La autenticación de clubes es por email en la tabla clubes
var pool   = require('../config/db');
var bcrypt = require('bcrypt');
var SALT_ROUNDS = 10;

function obtenerTodos() {
    return pool.query('SELECT * FROM clubes ORDER BY fecha_creacion DESC')
        .then(function(r) { return r.rows; });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM clubes WHERE id = $1', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function obtenerPorNombre(nombre, excluirId) {
    var q      = 'SELECT id FROM clubes WHERE LOWER(nombre) = LOWER($1)';
    var params = [nombre.trim()];
    if (excluirId) { q += ' AND id != $2'; params.push(excluirId); }
    return pool.query(q, params).then(function(r) { return r.rows[0] || null; });
}

function obtenerPorEmail(email, excluirId) {
    var q      = 'SELECT id FROM clubes WHERE LOWER(email) = LOWER($1)';
    var params = [email.trim()];
    if (excluirId) { q += ' AND id != $2'; params.push(excluirId); }
    return pool.query(q, params).then(function(r) { return r.rows[0] || null; });
}

function crear(datos) {
    // En el schema real clubes NO tiene password — se crea sin contraseña
    // Si tu sistema requiere password para clubes, agregar la columna al schema
    return pool.query(
        `INSERT INTO clubes (nombre, direccion, telefono, email, descripcion, estado, fecha_creacion, fecha_actualizacion)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
        [
            datos.nombre.trim(),
            datos.direccion ? datos.direccion.trim() : '',
            datos.telefono  ? datos.telefono.trim()  : '',
            datos.email     ? datos.email.trim()     : '',
            datos.descripcion ? datos.descripcion.trim() : '',
            datos.estado || 'activo'
        ]
    ).then(function(r) { return r.rows[0]; });
}

function actualizar(id, datos) {
    return pool.query(
        `UPDATE clubes SET
            nombre = $1, direccion = $2, telefono = $3, email = $4,
            descripcion = $5, estado = $6, fecha_actualizacion = NOW()
         WHERE id = $7 RETURNING *`,
        [
            datos.nombre.trim(),
            datos.direccion   ? datos.direccion.trim()   : '',
            datos.telefono    ? datos.telefono.trim()    : '',
            datos.email       ? datos.email.trim()       : '',
            datos.descripcion ? datos.descripcion.trim() : '',
            datos.estado,
            id
        ]
    ).then(function(r) { return r.rows[0] || null; });
}

function eliminar(id) {
    return pool.query('DELETE FROM clubes WHERE id = $1 RETURNING id', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function contarAtletasPorClub(clubId) {
    return pool.query('SELECT COUNT(*) AS total FROM atletas WHERE club_id = $1', [clubId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function obtenerEstadisticas() {
    return Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM clubes'),
        pool.query("SELECT COUNT(*) AS total FROM clubes WHERE estado = 'activo'"),
        pool.query("SELECT COUNT(*) AS total FROM clubes WHERE estado = 'inactivo'"),
        pool.query(
            `SELECT c.id, c.nombre, COUNT(a.id) AS total_atletas
             FROM clubes c
             LEFT JOIN atletas a ON a.club_id = c.id
             GROUP BY c.id, c.nombre
             ORDER BY total_atletas DESC`
        )
    ]).then(function(res) {
        return {
            totalClubes:     parseInt(res[0].rows[0].total, 10),
            clubesActivos:   parseInt(res[1].rows[0].total, 10),
            clubesInactivos: parseInt(res[2].rows[0].total, 10),
            atletasPorClub:  res[3].rows
        };
    });
}

function asociarAtletas(clubId, atletaIds) {
    var promesas = atletaIds.map(function(atletaId) {
        return pool.query('UPDATE atletas SET club_id = $1 WHERE id = $2', [clubId, atletaId]);
    });
    return Promise.all(promesas).then(function() { return atletaIds.length; });
}

function desasociarAtleta(atletaId, clubId) {
    return pool.query(
        'UPDATE atletas SET club_id = NULL WHERE id = $1 AND club_id = $2 RETURNING id',
        [atletaId, clubId]
    ).then(function(r) { return r.rows[0] || null; });
}

module.exports = {
    obtenerTodos, obtenerPorId, obtenerPorNombre, obtenerPorEmail,
    crear, actualizar, eliminar, contarAtletasPorClub,
    obtenerEstadisticas, asociarAtletas, desasociarAtleta
};
