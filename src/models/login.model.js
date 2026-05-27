//src/models/login.model.js
var pool = require('../config/db');

function buscarAtletaPorCurp(curp) {
    return pool.query(
        'SELECT * FROM registros WHERE curp = $1 AND rol = $2',
        [curp, 'atleta']
    ).then(function(result) { return result.rows[0] || null; });
}

function buscarClubPorEmail(email) {
    return pool.query(
        'SELECT * FROM clubes WHERE email = $1',
        [email]
    ).then(function(result) { return result.rows[0] || null; });
}

function buscarRegistroPorGmail(gmail, rol) {
    return pool.query(
        'SELECT * FROM registros WHERE gmail = $1 AND rol = $2',
        [gmail, rol]
    ).then(function(result) { return result.rows[0] || null; });
}

function buscarRegistroPorCurp(curp, rol) {
    return pool.query(
        'SELECT * FROM registros WHERE curp = $1 AND rol = $2',
        [curp, rol]
    ).then(function(result) { return result.rows[0] || null; });
}

module.exports = {
    buscarAtletaPorCurp,
    buscarClubPorEmail,
    buscarRegistroPorGmail,
    buscarRegistroPorCurp
};