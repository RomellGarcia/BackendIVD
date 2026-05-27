//src/models/login.model.js
var pool = require('../config/db');

//Atleta: busca por CURP con JOIN a atletas
function buscarAtletaPorCurp(curp) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio, a.lugar_entrenamiento
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         LEFT JOIN atletas a ON a.usuario_id = u.id
         WHERE u.curp = $1 AND r.nombre = 'atleta'`,
        [curp]
    ).then(function(r) { return r.rows[0] || null; });
}

//Club: busca por email en tabla clubes
function buscarClubPorEmail(email) {
    return pool.query(
        'SELECT * FROM clubes WHERE email = $1',
        [email]
    ).then(function(r) { return r.rows[0] || null; });
}

//Entrenador o administrador: busca por email
function buscarUsuarioPorEmail(email, rolNombre) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                e.id AS entrenador_id, e.club_id AS entrenador_club_id,
                e.anos_experiencia, e.estado AS entrenador_estado
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         LEFT JOIN entrenadores e ON e.usuario_id = u.id
         WHERE u.email = $1 AND r.nombre = $2`,
        [email, rolNombre]
    ).then(function(r) { return r.rows[0] || null; });
}

//Fallback por CURP para entrenador/administrador
function buscarUsuarioPorCurp(curp, rolNombre) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                e.id AS entrenador_id, e.club_id AS entrenador_club_id,
                e.anos_experiencia, e.estado AS entrenador_estado
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         LEFT JOIN entrenadores e ON e.usuario_id = u.id
         WHERE u.curp = $1 AND r.nombre = $2`,
        [curp, rolNombre]
    ).then(function(r) { return r.rows[0] || null; });
}

module.exports = {
    buscarAtletaPorCurp,
    buscarClubPorEmail,
    buscarUsuarioPorEmail,
    buscarUsuarioPorCurp
};