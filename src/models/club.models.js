// src/models/club.model.js
var pool = require('../config/db');
var bcrypt = require('bcrypt');

var SALT_ROUNDS = 10;

function obtenerTodos() {
    return pool.query('SELECT * FROM clubes ORDER BY fecha_creacion DESC')
        .then(function(result) { return result.rows; });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM clubes WHERE id = $1', [id])
        .then(function(result) { return result.rows[0] || null; });
}

function obtenerPorNombre(nombre, excluirId) {
    if (excluirId) {
        return pool.query(
            'SELECT id FROM clubes WHERE LOWER(nombre) = LOWER($1) AND id != $2',
            [nombre.trim(), excluirId]
        ).then(function(result) { return result.rows[0] || null; });
    }
    return pool.query(
        'SELECT id FROM clubes WHERE LOWER(nombre) = LOWER($1)',
        [nombre.trim()]
    ).then(function(result) { return result.rows[0] || null; });
}

function obtenerPorEmail(email, excluirId) {
    if (excluirId) {
        return pool.query(
            'SELECT id FROM clubes WHERE LOWER(email) = LOWER($1) AND id != $2',
            [email.trim(), excluirId]
        ).then(function(result) { return result.rows[0] || null; });
    }
    return pool.query(
        'SELECT id FROM clubes WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
    ).then(function(result) { return result.rows[0] || null; });
}

function crear(datos) {
    return bcrypt.hash(datos.password, SALT_ROUNDS)
        .then(function(hashedPassword) {
            return pool.query(
                `INSERT INTO clubes
                    (nombre, direccion, telefono, email, entrenador, descripcion, estado, rol, password, fecha_creacion, fecha_actualizacion)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
                RETURNING *`,
                [
                    datos.nombre.trim(),
                    datos.direccion.trim(),
                    datos.telefono.trim(),
                    datos.email    ? datos.email.trim()      : '',
                    datos.entrenador ? datos.entrenador.trim() : '',
                    datos.descripcion ? datos.descripcion.trim() : '',
                    datos.estado || 'activo',
                    datos.rol    || 'club',
                    hashedPassword
                ]
            );
        })
        .then(function(result) { return result.rows[0]; });
}

function actualizar(id, datos) {
    return pool.query(
        `UPDATE clubes SET
            nombre = $1,
            direccion = $2,
            telefono = $3,
            email = $4,
            entrenador = $5,
            descripcion = $6,
            estado = $7,
            fecha_actualizacion = NOW()
        WHERE id = $8
        RETURNING *`,
        [
            datos.nombre.trim(),
            datos.direccion.trim(),
            datos.telefono.trim(),
            datos.email       ? datos.email.trim()       : '',
            datos.entrenador  ? datos.entrenador.trim()  : '',
            datos.descripcion ? datos.descripcion.trim() : '',
            datos.estado,
            id
        ]
    ).then(function(result) { return result.rows[0] || null; });
}

function eliminar(id) {
    return pool.query('DELETE FROM clubes WHERE id = $1 RETURNING id', [id])
        .then(function(result) { return result.rows[0] || null; });
}

function contarAtletasPorClub(clubId) {
    return pool.query(
        'SELECT COUNT(*) AS total FROM registros WHERE club_id = $1 AND rol = $2',
        [clubId, 'atleta']
    ).then(function(result) { return parseInt(result.rows[0].total, 10); });
}

function obtenerEstadisticas() {
    return Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM clubes'),
        pool.query("SELECT COUNT(*) AS total FROM clubes WHERE estado = 'activo'"),
        pool.query("SELECT COUNT(*) AS total FROM clubes WHERE estado = 'inactivo'"),
        pool.query(
            `SELECT c.id, c.nombre, COUNT(r.id) AS total_atletas
             FROM clubes c
             LEFT JOIN registros r ON r.club_id = c.id AND r.rol = 'atleta'
             GROUP BY c.id, c.nombre
             ORDER BY total_atletas DESC`
        )
    ]).then(function(results) {
        return {
            totalClubes:     parseInt(results[0].rows[0].total, 10),
            clubesActivos:   parseInt(results[1].rows[0].total, 10),
            clubesInactivos: parseInt(results[2].rows[0].total, 10),
            atletasPorClub:  results[3].rows
        };
    });
}

function asociarAtletas(clubId, atletaIds) {
    return pool.query(
        'UPDATE registros SET club_id = $1 WHERE id = ANY($2::int[]) AND rol = $3',
        [clubId, atletaIds, 'atleta']
    ).then(function(result) { return result.rowCount; });
}

function desasociarAtleta(atletaId, clubId) {
    return pool.query(
        'UPDATE registros SET club_id = NULL WHERE id = $1 AND club_id = $2 AND rol = $3 RETURNING id',
        [atletaId, clubId, 'atleta']
    ).then(function(result) { return result.rows[0] || null; });
}

module.exports = {
    obtenerTodos,
    obtenerPorId,
    obtenerPorNombre,
    obtenerPorEmail,
    crear,
    actualizar,
    eliminar,
    contarAtletasPorClub,
    obtenerEstadisticas,
    asociarAtletas,
    desasociarAtleta
};