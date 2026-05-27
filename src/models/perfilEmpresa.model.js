//src/models/perfilEmpresa.model.js
var pool = require('../config/db');

function obtener() {
    return pool.query('SELECT * FROM perfil_empresa LIMIT 1')
        .then(function(result) { return result.rows[0] || null; });
}

function existe() {
    return pool.query('SELECT id FROM perfil_empresa LIMIT 1')
        .then(function(result) { return !!result.rows[0]; });
}

function crear(datos) {
    return pool.query(
        `INSERT INTO perfil_empresa
            (nombre_empresa, eslogan, logo, direccion, correo, telefono,
             facebook, instagram, twitter, mostrar_whatsapp, fecha_creacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         RETURNING *`,
        [
            datos.nombreEmpresa,
            datos.eslogan,
            datos.logo        || '',
            datos.direccion,
            datos.correo,
            datos.telefono,
            datos.facebook    || '',
            datos.instagram   || '',
            datos.twitter     || '',
            datos.mostrarWhatsapp
        ]
    ).then(function(result) { return result.rows[0]; });
}

function actualizar(datos) {
    var params = [
        datos.nombreEmpresa,
        datos.eslogan,
        datos.direccion,
        datos.correo,
        datos.telefono,
        datos.facebook    || '',
        datos.instagram   || '',
        datos.twitter     || '',
        datos.mostrarWhatsapp
    ];

    //Logo es opcional
    if (datos.logo !== undefined) {
        params.push(datos.logo);
        return pool.query(
            `UPDATE perfil_empresa SET
                nombre_empresa    = $1,
                eslogan           = $2,
                direccion         = $3,
                correo            = $4,
                telefono          = $5,
                facebook          = $6,
                instagram         = $7,
                twitter           = $8,
                mostrar_whatsapp  = $9,
                logo              = $10,
                fecha_actualizacion = NOW()
             RETURNING *`,
            params
        ).then(function(result) { return result.rows[0] || null; });
    }

    return pool.query(
        `UPDATE perfil_empresa SET
            nombre_empresa    = $1,
            eslogan           = $2,
            direccion         = $3,
            correo            = $4,
            telefono          = $5,
            facebook          = $6,
            instagram         = $7,
            twitter           = $8,
            mostrar_whatsapp  = $9,
            fecha_actualizacion = NOW()
         RETURNING *`,
        params
    ).then(function(result) { return result.rows[0] || null; });
}

function eliminar() {
    return pool.query('DELETE FROM perfil_empresa RETURNING id')
        .then(function(result) { return result.rows[0] || null; });
}

module.exports = { obtener, existe, crear, actualizar, eliminar };