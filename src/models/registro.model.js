// src/models/registro.model.js
var pool   = require('../config/db');
var bcrypt = require('bcrypt');
var SALT_ROUNDS = 10;

// ── Lookups de FKs ────────────────────────────────────────────────────────────

function obtenerRolId(nombre) {
    return pool.query('SELECT id FROM roles WHERE nombre = $1', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

function obtenerGeneroId(nombre) {
    if (!nombre) return Promise.resolve(null);
    return pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

// ── Verificaciones ────────────────────────────────────────────────────────────

function existeCurp(curp) {
    return pool.query('SELECT id FROM usuarios WHERE curp = $1', [curp])
        .then(function(r) { return !!r.rows[0]; });
}

function existeEmail(email) {
    return pool.query('SELECT id FROM usuarios WHERE email = $1', [email])
        .then(function(r) { return !!r.rows[0]; });
}

// ── Crear usuario (INSERT en usuarios + atletas o entrenadores) ───────────────

function crear(datos) {
    return bcrypt.hash(datos.password, SALT_ROUNDS)
        .then(function(hash) {
            return Promise.all([
                Promise.resolve(hash),
                obtenerRolId(datos.rol),
                obtenerGeneroId(datos.sexo)
            ]);
        })
        .then(function(res) {
            var hash    = res[0];
            var rolId   = res[1];
            var genId   = res[2];

            if (!rolId) throw new Error('Rol no encontrado: ' + datos.rol);

            return pool.query(
                `INSERT INTO usuarios
                    (curp, nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
                     telefono, email, password, estado_nacimiento, rol_id, genero_id, fecha_registro)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
                 RETURNING *`,
                [
                    datos.curp,
                    datos.nombre,
                    datos.apellidopa,
                    datos.apellidoma,
                    datos.fechaNacimiento,
                    datos.telefono,
                    datos.gmail,
                    hash,
                    datos.estadoNacimiento,
                    rolId,
                    genId
                ]
            );
        })
        .then(function(r) {
            var usuario = r.rows[0];

            if (datos.rol === 'atleta') {
                return pool.query(
                    `INSERT INTO atletas (usuario_id, club_id, municipio)
                     VALUES ($1, $2, $3) RETURNING *`,
                    [usuario.id, datos.clubId || null, datos.municipio || null]
                ).then(function() { return usuario; });
            }

            if (datos.rol === 'entrenador') {
                return pool.query(
                    `INSERT INTO entrenadores (usuario_id, club_id, anos_experiencia, estado)
                     VALUES ($1, $2, $3, 'activo') RETURNING *`,
                    [usuario.id, datos.clubId || null, datos.añosExperiencia || 0]
                ).then(function(entRes) {
                    var entrenador = entRes.rows[0];
                    var promesas   = [];

                    if (datos.certificaciones && datos.certificaciones.length > 0) {
                        datos.certificaciones.forEach(function(cert) {
                            promesas.push(pool.query(
                                'INSERT INTO certificaciones (entrenador_id, nombre) VALUES ($1, $2)',
                                [entrenador.id, cert]
                            ));
                        });
                    }
                    if (datos.especialidades && datos.especialidades.length > 0) {
                        datos.especialidades.forEach(function(esp) {
                            promesas.push(pool.query(
                                'INSERT INTO especialidades (entrenador_id, nombre) VALUES ($1, $2)',
                                [entrenador.id, esp]
                            ));
                        });
                    }
                    return Promise.all(promesas).then(function() { return usuario; });
                });
            }

            return usuario;
        });
}

// ── Consultas con JOIN completo ───────────────────────────────────────────────

function obtenerUsuarioCompleto(usuarioId) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio, a.lugar_entrenamiento,
                e.id AS entrenador_id, e.club_id AS entrenador_club_id, e.anos_experiencia, e.estado AS entrenador_estado
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         LEFT JOIN atletas a ON a.usuario_id = u.id
         LEFT JOIN entrenadores e ON e.usuario_id = u.id
         WHERE u.id = $1`,
        [usuarioId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerAtletaPorUsuarioId(usuarioId) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio, a.lugar_entrenamiento
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         JOIN atletas a ON a.usuario_id = u.id
         WHERE u.id = $1`,
        [usuarioId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerAtletaPorAtletaId(atletaId) {
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio, a.lugar_entrenamiento
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         JOIN atletas a ON a.usuario_id = u.id
         WHERE a.id = $1`,
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function obtenerClubes() {
    return pool.query('SELECT * FROM clubes ORDER BY nombre ASC')
        .then(function(r) { return r.rows; });
}

function obtenerAtletas(filtro) {
    var condiciones = ["r.nombre = 'atleta'"];
    var params      = [];
    var idx         = 1;

    if (filtro.clubId) {
        condiciones.push('a.club_id = $' + idx++);
        params.push(filtro.clubId);
    } else if (filtro.independientes || filtro.sinClub) {
        condiciones.push('a.club_id IS NULL');
    }

    var limite = filtro.limit ? (' LIMIT $' + idx) : '';
    if (filtro.limit) params.push(filtro.limit);

    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         JOIN atletas a ON a.usuario_id = u.id
         WHERE ` + condiciones.join(' AND ') + ' ORDER BY u.nombre ASC' + limite,
        params
    ).then(function(r) { return r.rows; });
}

function obtenerAtletasPorClub(clubId, opciones) {
    opciones = opciones || {};
    var params = [clubId];
    var limite = '';
    if (opciones.limit) { limite = ' LIMIT $2'; params.push(opciones.limit); }

    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre,
                a.id AS atleta_id, a.club_id, a.municipio, a.lugar_entrenamiento
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id
         JOIN atletas a ON a.usuario_id = u.id
         WHERE a.club_id = $1
         ORDER BY u.nombre ASC` + limite,
        params
    ).then(function(r) { return r.rows; });
}

function obtenerUsuarios(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.rol) {
        condiciones.push('r.nombre = $' + idx++);
        params.push(filtro.rol);
    }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    return pool.query(
        `SELECT u.*, r.nombre AS rol_nombre, g.nombre AS genero_nombre
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         LEFT JOIN generos g ON g.id = u.genero_id` + where,
        params
    ).then(function(r) { return r.rows; });
}

// ── Actualizar ────────────────────────────────────────────────────────────────

function actualizarClubAtleta(atletaId, clubId) {
    return pool.query(
        'UPDATE atletas SET club_id = $1 WHERE id = $2 RETURNING id',
        [clubId || null, atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function actualizar(usuarioId, datos) {
    var camposU  = [];
    var paramsU  = [];
    var idx      = 1;

    var mapaU = {
        nombre:           'nombre',
        apellidopa:       'apellido_paterno',
        apellidoma:       'apellido_materno',
        fechaNacimiento:  'fecha_nacimiento',
        telefono:         'telefono',
        gmail:            'email',
        estadoNacimiento: 'estado_nacimiento'
    };

    Object.keys(mapaU).forEach(function(k) {
        if (datos[k] !== undefined) {
            camposU.push(mapaU[k] + ' = $' + idx++);
            paramsU.push(datos[k]);
        }
    });

    var promesaUsuario = Promise.resolve(null);
    if (camposU.length > 0) {
        paramsU.push(usuarioId);
        promesaUsuario = pool.query(
            'UPDATE usuarios SET ' + camposU.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
            paramsU
        ).then(function(r) { return r.rows[0]; });
    }

    // Actualizar atleta si viene clubId
    var promesaAtleta = Promise.resolve(null);
    if (datos.hasOwnProperty('clubId')) {
        promesaAtleta = pool.query(
            'UPDATE atletas SET club_id = $1 WHERE usuario_id = $2',
            [datos.clubId || null, usuarioId]
        );
    }

    return Promise.all([promesaUsuario, promesaAtleta])
        .then(function(res) { return res[0]; });
}

// ── Solicitudes de club ───────────────────────────────────────────────────────

function obtenerSolicitudesPendientesAtleta(atletaId) {
    return pool.query(
        "SELECT id FROM solicitudes_club WHERE usuario_id = $1 AND estado = 'pendiente'",
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function verificarClubExiste(clubId) {
    return pool.query('SELECT id FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return !!r.rows[0]; });
}

function crearSolicitudClub(datos) {
    return pool.query(
        `INSERT INTO solicitudes_club (usuario_id, club_id, tipo, estado, fecha_solicitud)
         VALUES ($1, $2, $3, 'pendiente', NOW()) RETURNING *`,
        [datos.atletaId, datos.clubId || null, datos.tipo]
    ).then(function(r) { return r.rows[0]; });
}

function obtenerSolicitudesClub(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.clubId)   { condiciones.push('club_id = $'    + idx++); params.push(filtro.clubId); }
    if (filtro.atletaId) { condiciones.push('usuario_id = $' + idx++); params.push(filtro.atletaId); }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    return pool.query('SELECT * FROM solicitudes_club' + where, params)
        .then(function(r) { return r.rows; });
}

function obtenerSolicitudClubPorId(id) {
    return pool.query('SELECT * FROM solicitudes_club WHERE id = $1', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function procesarSolicitudClub(solicitudId, estado, solicitud) {
    var promesaEstado = pool.query(
        'UPDATE solicitudes_club SET estado = $1 WHERE id = $2',
        [estado, solicitudId]
    );

    if (estado !== 'aceptada') return promesaEstado;

    var promesaAtleta;
    if (solicitud.tipo === 'asociar') {
        promesaAtleta = pool.query(
            'UPDATE atletas SET club_id = $1, fecha_ingreso_club = NOW() WHERE usuario_id = $2',
            [solicitud.club_id, solicitud.usuario_id]
        );
    } else {
        promesaAtleta = pool.query(
            'UPDATE atletas SET club_id = NULL WHERE usuario_id = $1',
            [solicitud.usuario_id]
        );
    }

    return Promise.all([promesaEstado, promesaAtleta]);
}

// ── Eliminación con validaciones ──────────────────────────────────────────────

function contarResultadosAtleta(atletaId) {
    return pool.query('SELECT COUNT(*) AS total FROM resultados WHERE atleta_id = $1', [atletaId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function contarInscripcionesAtleta(atletaId) {
    return pool.query('SELECT COUNT(*) AS total FROM inscripciones WHERE atleta_id = $1', [atletaId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function contarAtletasDeClub(clubId) {
    return pool.query('SELECT COUNT(*) AS total FROM atletas WHERE club_id = $1', [clubId])
        .then(function(r) { return parseInt(r.rows[0].total, 10); });
}

function eliminar(usuarioId) {
    // Eliminar atleta/entrenador primero por FK, luego usuario
    return pool.query('DELETE FROM atletas      WHERE usuario_id = $1', [usuarioId])
        .then(function() {
            return pool.query('DELETE FROM entrenadores WHERE usuario_id = $1', [usuarioId]);
        })
        .then(function() {
            return pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [usuarioId]);
        })
        .then(function(r) { return r.rows[0] || null; });
}

module.exports = {
    obtenerRolId,
    obtenerGeneroId,
    existeCurp,
    existeEmail,
    crear,
    obtenerUsuarioCompleto,
    obtenerAtletaPorUsuarioId,
    obtenerAtletaPorAtletaId,
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