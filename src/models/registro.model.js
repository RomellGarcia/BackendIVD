//src/models/registro.model.js
var pool   = require('../config/db');
var bcrypt = require('bcrypt');

var SALT_ROUNDS = 10;

//Registro

function existeCurp(curp) {
    return pool.query('SELECT id FROM registros WHERE curp = $1', [curp])
        .then(function(r) { return !!r.rows[0]; });
}

function existeGmail(gmail) {
    return pool.query('SELECT id FROM registros WHERE gmail = $1', [gmail])
        .then(function(r) { return !!r.rows[0]; });
}

function crear(datos) {
    return bcrypt.hash(datos.password, SALT_ROUNDS)
        .then(function(hash) {
            return pool.query(
                `INSERT INTO registros
                    (curp, nombre, apellidopa, apellidoma, fecha_nacimiento, rol, telefono,
                     gmail, password, sexo, estado_nacimiento, club_id,
                     certificaciones, especialidades, anos_experiencia, estado, fecha_registro)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
                 RETURNING *`,
                [
                    datos.curp,
                    datos.nombre,
                    datos.apellidopa,
                    datos.apellidoma,
                    datos.fechaNacimiento,
                    datos.rol,
                    datos.telefono,
                    datos.gmail,
                    hash,
                    datos.sexo,
                    datos.estadoNacimiento,
                    datos.clubId     || null,
                    datos.certificaciones  ? JSON.stringify(datos.certificaciones)  : null,
                    datos.especialidades   ? JSON.stringify(datos.especialidades)   : null,
                    datos.añosExperiencia  || 0,
                    datos.estado     || 'activo'
                ]
            );
        })
        .then(function(r) { return r.rows[0]; });
}

//Consultas generales
function obtenerPorId(id) {
    return pool.query('SELECT * FROM registros WHERE id = $1', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function obtenerAtletaPorId(id) {
    return pool.query("SELECT * FROM registros WHERE id = $1 AND rol = 'atleta'", [id])
        .then(function(r) { return r.rows[0] || null; });
}

function obtenerClubes() {
    return pool.query('SELECT * FROM clubes ORDER BY nombre ASC')
        .then(function(r) { return r.rows; });
}

function obtenerAtletas(filtro) {
    //filtro: { clubId, independientes, rol, sinClub }
    var condiciones = ["rol = 'atleta'"];
    var params      = [];
    var idx         = 1;

    if (filtro.clubId) {
        condiciones.push('club_id = $' + idx++);
        params.push(filtro.clubId);
    } else if (filtro.independientes) {
        condiciones.push('club_id IS NULL');
    }

    if (filtro.sinClub) {
        condiciones.push('club_id IS NULL');
    }

    var orden = filtro.sort === 'createdAt' ? ' ORDER BY id DESC' : ' ORDER BY nombre ASC';
    var limite = filtro.limit ? (' LIMIT $' + idx) : '';
    if (filtro.limit) params.push(filtro.limit);

    return pool.query(
        'SELECT * FROM registros WHERE ' + condiciones.join(' AND ') + orden + limite,
        params
    ).then(function(r) { return r.rows; });
}

function obtenerAtletasPorClub(clubId, opciones) {
    opciones = opciones || {};
    var params = [clubId];
    var orden  = opciones.sort === 'createdAt' ? ' ORDER BY id DESC' : ' ORDER BY nombre ASC';
    var limite = '';
    if (opciones.limit) {
        limite = ' LIMIT $2';
        params.push(opciones.limit);
    }
    return pool.query(
        "SELECT * FROM registros WHERE club_id = $1 AND rol = 'atleta'" + orden + limite,
        params
    ).then(function(r) { return r.rows; });
}

function obtenerUsuarios(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.rol) {
        condiciones.push('rol = $' + idx++);
        params.push(filtro.rol);
    }
    if (filtro.sinClub && filtro.rol === 'atleta') {
        condiciones.push('club_id IS NULL');
    }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    return pool.query('SELECT * FROM registros' + where, params)
        .then(function(r) { return r.rows; });
}

//Actualizar
function actualizarClubAtleta(id, clubId) {
    //clubId = null -> desasociar, clubId = valor -> asociar
    return pool.query(
        "UPDATE registros SET club_id = $1 WHERE id = $2 AND rol = 'atleta' RETURNING id",
        [clubId || null, id]
    ).then(function(r) { return r.rows[0] || null; });
}

function actualizar(id, datos) {
    var campos  = [];
    var params  = [];
    var idx     = 1;

    var mapaColumnas = {
        nombre:           'nombre',
        apellidopa:       'apellidopa',
        apellidoma:       'apellidoma',
        fechaNacimiento:  'fecha_nacimiento',
        telefono:         'telefono',
        gmail:            'gmail',
        sexo:             'sexo',
        estadoNacimiento: 'estado_nacimiento',
        rol:              'rol',
        certificaciones:  'certificaciones',
        especialidades:   'especialidades',
        añosExperiencia:  'anos_experiencia',
        estado:           'estado'
    };

    Object.keys(mapaColumnas).forEach(function(campo) {
        if (datos[campo] !== undefined) {
            campos.push(mapaColumnas[campo] + ' = $' + idx++);
            var val = datos[campo];
            //Arrays -> JSON string para columnas jsonb/text[]
            if (Array.isArray(val)) val = JSON.stringify(val);
            params.push(val);
        }
    });

    //club_id se maneja aparte porque puede ser null explícito
    if (datos.hasOwnProperty('clubId')) {
        campos.push('club_id = $' + idx++);
        params.push(datos.clubId || null);
    }

    if (campos.length === 0) return Promise.resolve(null);

    params.push(id);
    return pool.query(
        'UPDATE registros SET ' + campos.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
        params
    ).then(function(r) { return r.rows[0] || null; });
}

//Solicitudes de club 
function obtenerSolicitudesPendientesAtleta(atletaId) {
    return pool.query(
        "SELECT id FROM solicitudes_club WHERE atleta_id = $1 AND estado = 'pendiente'",
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function verificarClubExiste(clubId) {
    return pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return !!r.rows[0]; });
}

function crearSolicitudClub(datos) {
    return pool.query(
        `INSERT INTO solicitudes_club (atleta_id, club_id, tipo, estado, fecha_solicitud)
         VALUES ($1, $2, $3, 'pendiente', NOW()) RETURNING *`,
        [datos.atletaId, datos.clubId || null, datos.tipo]
    ).then(function(r) { return r.rows[0]; });
}

function obtenerSolicitudesClub(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.clubId) {
        condiciones.push('club_id = $' + idx++);
        params.push(filtro.clubId);
    }
    if (filtro.atletaId) {
        condiciones.push('atleta_id = $' + idx++);
        params.push(filtro.atletaId);
    }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    return pool.query('SELECT * FROM solicitudes_club' + where, params)
        .then(function(r) { return r.rows; });
}

function obtenerSolicitudClubPorId(id) {
    return pool.query('SELECT * FROM solicitudes_club WHERE id = $1', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function procesarSolicitudClub(solicitudId, estado, solicitud) {
    //Actualizar estado de la solicitud
    var promesaEstado = pool.query(
        'UPDATE solicitudes_club SET estado = $1 WHERE id = $2',
        [estado, solicitudId]
    );

    if (estado !== 'aceptada') return promesaEstado;

    // Si se acepta actualizar atleta según tipo
    var promesaAtleta;
    if (solicitud.tipo === 'asociar') {
        promesaAtleta = pool.query(
            "UPDATE registros SET club_id = $1, fecha_ingreso_club = NOW() WHERE id = $2 AND rol = 'atleta'",
            [solicitud.club_id, solicitud.atleta_id]
        );
    } else {
        //independiente quitar club
        promesaAtleta = pool.query(
            "UPDATE registros SET club_id = NULL WHERE id = $1 AND rol = 'atleta'",
            [solicitud.atleta_id]
        );
    }

    return Promise.all([promesaEstado, promesaAtleta]);
}

//Eliminación con validaciones
function contarResultadosAtleta(atletaId) {
    return pool.query('SELECT COUNT(*) AS total FROM resultados WHERE atleta_id = $1', [atletaId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function contarInscripcionesAtleta(atletaId) {
    return pool.query('SELECT COUNT(*) AS total FROM inscripciones WHERE atleta_id = $1', [atletaId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function contarAtletasDeClub(clubId) {
    return pool.query(
        "SELECT COUNT(*) AS total FROM registros WHERE club_id = $1 AND rol = 'atleta'",
        [clubId]
    ).then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function eliminar(id) {
    return pool.query('DELETE FROM registros WHERE id = $1 RETURNING id', [id])
        .then(function(r) { return r.rows[0] || null; });
}

module.exports = {
    existeCurp,
    existeGmail,
    crear,
    obtenerPorId,
    obtenerAtletaPorId,
    obtenerClubes,
    obtenerAtletas,
    obtenerAtletasPorClub,
    obtenerUsuarios,
    actualizarClubAtleta,
    actualizar,
    obtenerSolicitudesPendientesAtleta,
    verificarClubExiste,
    crearSolicitudClub,
    obtenerSolicitudesClub,
    obtenerSolicitudClubPorId,
    procesarSolicitudClub,
    contarResultadosAtleta,
    contarInscripcionesAtleta,
    contarAtletasDeClub,
    eliminar
};