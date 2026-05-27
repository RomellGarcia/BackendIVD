//src/models/sesion.model.js
var pool = require('../config/db');

//Helper interno

function parsearArrays(sesion) {
    if (!sesion) return sesion;

    ['ejercicios', 'material_necesario', 'atletas_asignados'].forEach(function(campo) {
        if (sesion[campo] && typeof sesion[campo] === 'string') {
            try { sesion[campo] = JSON.parse(sesion[campo]); } catch (e) { sesion[campo] = []; }
        }
    });

    return sesion;
}

//CRUD
function crear(datos) {
    return pool.query(
        `INSERT INTO sesiones
            (titulo, descripcion, fecha_inicio, duracion, tipo_entrenamiento,
             ejercicios, intensidad, material_necesario, notas,
             entrenador_id, club_id, atletas_asignados, estado,
             fecha_creacion, fecha_actualizacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'programada',NOW(),NOW())
         RETURNING *`,
        [
            datos.titulo,
            datos.descripcion        || '',
            new Date(datos.fechaInicio),
            parseInt(datos.duracion, 10),
            datos.tipoEntrenamiento,
            JSON.stringify(datos.ejercicios        || []),
            datos.intensidad,
            JSON.stringify(datos.materialNecesario || []),
            datos.notas              || '',
            datos.entrenadorId,
            datos.clubId,
            JSON.stringify(datos.atletasAsignados  || [])
        ]
    ).then(function(r) { return parsearArrays(r.rows[0]); });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM sesiones WHERE id = $1', [id])
        .then(function(r) { return parsearArrays(r.rows[0] || null); });
}

function obtenerPorEntrenador(entrenadorId) {
    return pool.query(
        'SELECT * FROM sesiones WHERE entrenador_id = $1 ORDER BY fecha_inicio ASC',
        [entrenadorId]
    ).then(function(r) { return r.rows.map(parsearArrays); });
}

function obtenerPorClub(clubId) {
    return pool.query(
        'SELECT * FROM sesiones WHERE club_id = $1 ORDER BY fecha_inicio ASC',
        [clubId]
    ).then(function(r) { return r.rows.map(parsearArrays); });
}

//atletas_asignados es JSONB — busca sesiones donde el array contenga el atletaId
function obtenerPorAtleta(atletaId) {
    return pool.query(
        'SELECT * FROM sesiones WHERE atletas_asignados @> $1::jsonb ORDER BY fecha_inicio ASC',
        [JSON.stringify([parseInt(atletaId, 10)])]
    ).then(function(r) { return r.rows.map(parsearArrays); });
}

function actualizar(id, datos) {
    var campos = [];
    var params = [];
    var idx    = 1;

    var mapa = {
        titulo:             'titulo',
        descripcion:        'descripcion',
        duracion:           'duracion',
        tipoEntrenamiento:  'tipo_entrenamiento',
        intensidad:         'intensidad',
        notas:              'notas',
        entrenadorId:       'entrenador_id',
        clubId:             'club_id',
        estado:             'estado'
    };

    Object.keys(mapa).forEach(function(campo) {
        if (datos[campo] !== undefined) {
            campos.push(mapa[campo] + ' = $' + idx++);
            params.push(datos[campo]);
        }
    });

    if (datos.fechaInicio !== undefined) {
        campos.push('fecha_inicio = $' + idx++);
        params.push(new Date(datos.fechaInicio));
    }
    if (datos.ejercicios !== undefined) {
        campos.push('ejercicios = $' + idx++);
        params.push(JSON.stringify(datos.ejercicios));
    }
    if (datos.materialNecesario !== undefined) {
        campos.push('material_necesario = $' + idx++);
        params.push(JSON.stringify(datos.materialNecesario));
    }
    if (datos.atletasAsignados !== undefined) {
        campos.push('atletas_asignados = $' + idx++);
        params.push(JSON.stringify(datos.atletasAsignados));
    }

    campos.push('fecha_actualizacion = NOW()');
    params.push(id);

    return pool.query(
        'UPDATE sesiones SET ' + campos.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
        params
    ).then(function(r) { return parsearArrays(r.rows[0] || null); });
}

function eliminar(id) {
    return pool.query('DELETE FROM sesiones WHERE id = $1 RETURNING id', [id])
        .then(function(r) { return r.rows[0] || null; });
}

module.exports = {
    crear,
    obtenerPorId,
    obtenerPorEntrenador,
    obtenerPorClub,
    obtenerPorAtleta,
    actualizar,
    eliminar
};