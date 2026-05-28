// src/models/evento.model.js
// convocatorias ahora usan FKs: disciplina_id, categoria_id, genero_id
// inscripciones usan atleta_id (FK a atletas.id, no a usuarios.id)
var pool = require('../config/db');

// ── Helpers para resolver FKs de catálogos ────────────────────────────────────

function obtenerDisciplinaId(nombre) {
    if (!nombre) return Promise.resolve(null);
    return pool.query('SELECT id FROM disciplinas WHERE LOWER(nombre) = LOWER($1)', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

function obtenerCategoriaId(nombre) {
    if (!nombre) return Promise.resolve(null);
    return pool.query('SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1)', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

function obtenerGeneroId(nombre) {
    if (!nombre) return Promise.resolve(null);
    return pool.query('SELECT id FROM generos WHERE LOWER(nombre) = LOWER($1)', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

// ── Eventos ───────────────────────────────────────────────────────────────────

function obtenerTodos(limite) {
    var q = 'SELECT * FROM eventos WHERE estado = true ORDER BY created_at DESC';
    return pool.query(limite ? q + ' LIMIT $1' : q, limite ? [limite] : [])
        .then(function(r) { return r.rows; });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM eventos WHERE id = $1', [id])
        .then(function(r) { return r.rows[0] || null; });
}

function crearEvento(datos) {
    return pool.query(
        `INSERT INTO eventos (titulo, fecha, hora, lugar, descripcion, fecha_cierre, estado, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,NOW()) RETURNING *`,
        [datos.titulo, datos.fecha, datos.hora, datos.lugar, datos.descripcion || '', datos.fechaCierre]
    ).then(function(r) { return r.rows[0]; });
}

function actualizarFechaCierre(id, fechaCierre) {
    return pool.query(
        'UPDATE eventos SET fecha_cierre = $1 WHERE id = $2 RETURNING *',
        [fechaCierre, id]
    ).then(function(r) { return r.rows[0] || null; });
}

// ── Convocatorias ─────────────────────────────────────────────────────────────

function crearConvocatoria(eventoId, conv) {
    return Promise.all([
        obtenerDisciplinaId(conv.disciplina),
        obtenerCategoriaId(conv.categoria),
        obtenerGeneroId(conv.genero)
    ]).then(function(ids) {
        return pool.query(
            `INSERT INTO convocatorias (evento_id, disciplina_id, categoria_id, genero_id, estado, created_at)
             VALUES ($1,$2,$3,$4,true,NOW()) RETURNING *`,
            [eventoId, ids[0], ids[1], ids[2]]
        );
    }).then(function(r) { return r.rows[0]; });
}

function obtenerConvocatoriasPorEvento(eventoId) {
    return pool.query(
        `SELECT c.*, d.nombre AS disciplina, cat.nombre AS categoria, g.nombre AS genero,
                cat.edad_min, cat.edad_max
         FROM convocatorias c
         LEFT JOIN disciplinas d ON d.id = c.disciplina_id
         LEFT JOIN categorias cat ON cat.id = c.categoria_id
         LEFT JOIN generos g ON g.id = c.genero_id
         WHERE c.evento_id = $1 AND c.estado = true`,
        [eventoId]
    ).then(function(r) { return r.rows; });
}

function obtenerEventoConConvocatorias(eventoId) {
    return Promise.all([obtenerPorId(eventoId), obtenerConvocatoriasPorEvento(eventoId)])
        .then(function(res) {
            var evento = res[0];
            if (!evento) return null;
            evento.convocatorias = res[1];
            return evento;
        });
}

function obtenerConvocatoriasParaAtleta(edad, genero) {
    return pool.query(
        `SELECT e.id, e.titulo, e.fecha, e.hora, e.lugar, e.descripcion, e.fecha_cierre, e.estado,
                c.id AS convocatoria_id,
                d.nombre AS disciplina,
                cat.nombre AS categoria,
                cat.edad_min, cat.edad_max,
                g.nombre AS genero
         FROM eventos e
         INNER JOIN convocatorias c ON c.evento_id = e.id
         LEFT JOIN disciplinas d ON d.id = c.disciplina_id
         LEFT JOIN categorias cat ON cat.id = c.categoria_id
         LEFT JOIN generos g ON g.id = c.genero_id
         WHERE e.fecha_cierre > NOW()
           AND e.estado = true
           AND c.estado = true
           AND cat.edad_min <= $1
           AND cat.edad_max >= $1
           AND (LOWER(g.nombre) = $2 OR LOWER(g.nombre) = 'mixto')
         ORDER BY e.fecha ASC`,
        [edad, genero.toLowerCase()]
    ).then(function(r) { return r.rows; });
}

// ── Atleta ────────────────────────────────────────────────────────────────────

function obtenerAtletaPorId(atletaId) {
    return pool.query(
        `SELECT u.*, a.id AS atleta_id, a.club_id, a.municipio,
                g.nombre AS genero_nombre
         FROM atletas a
         JOIN usuarios u ON u.id = a.usuario_id
         LEFT JOIN generos g ON g.id = u.genero_id
         WHERE a.id = $1`,
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

// ── Inscripciones ─────────────────────────────────────────────────────────────

function existeInscripcion(convocatoriaId, atletaId) {
    return pool.query(
        'SELECT id FROM inscripciones WHERE convocatoria_id = $1 AND atleta_id = $2',
        [convocatoriaId, atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function crearInscripcion(datos) {
    return pool.query(
        `INSERT INTO inscripciones (atleta_id, convocatoria_id, validado, fecha_inscripcion)
         VALUES ($1,$2,true,NOW()) RETURNING *`,
        [datos.atletaId, datos.convocatoriaId]
    ).then(function(r) { return r.rows[0]; });
}

function obtenerInscripciones(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.atletaId) { condiciones.push('i.atleta_id = $'       + idx++); params.push(filtro.atletaId); }
    if (filtro.eventoId) { condiciones.push('c.evento_id = $'       + idx++); params.push(filtro.eventoId); }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';

    return pool.query(
        `SELECT i.*, c.evento_id, e.titulo AS nombre_evento,
                u.nombre AS nombre_atleta
         FROM inscripciones i
         JOIN convocatorias c ON c.id = i.convocatoria_id
         JOIN eventos e ON e.id = c.evento_id
         JOIN atletas a ON a.id = i.atleta_id
         JOIN usuarios u ON u.id = a.usuario_id` + where,
        params
    ).then(function(r) { return r.rows; });
}

function obtenerParticipantesPorEvento(eventoId) {
    return pool.query(
        `SELECT i.*, u.nombre, u.apellido_paterno, u.apellido_materno,
                g.nombre AS genero_nombre
         FROM inscripciones i
         JOIN convocatorias c ON c.id = i.convocatoria_id
         JOIN atletas a ON a.id = i.atleta_id
         JOIN usuarios u ON u.id = a.usuario_id
         LEFT JOIN generos g ON g.id = u.genero_id
         WHERE c.evento_id = $1
         ORDER BY i.fecha_inscripcion ASC`,
        [eventoId]
    ).then(function(r) { return r.rows; });
}

function obtenerResumenEventos() {
    return Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM eventos'),
        pool.query('SELECT COUNT(*) AS total FROM eventos WHERE estado = true'),
        pool.query('SELECT COUNT(*) AS total FROM eventos WHERE estado = true AND fecha_cierre > NOW()'),
        pool.query('SELECT * FROM eventos ORDER BY created_at DESC')
    ]).then(function(res) {
        return {
            totalEventos:    parseInt(res[0].rows[0].total, 10),
            eventosActivos:  parseInt(res[1].rows[0].total, 10),
            eventosAbiertos: parseInt(res[2].rows[0].total, 10),
            detalle:         res[3].rows
        };
    });
}

module.exports = {
    obtenerTodos, obtenerPorId, crearEvento, actualizarFechaCierre,
    crearConvocatoria, obtenerConvocatoriasPorEvento, obtenerEventoConConvocatorias,
    obtenerConvocatoriasParaAtleta, obtenerAtletaPorId,
    existeInscripcion, crearInscripcion, obtenerInscripciones,
    obtenerParticipantesPorEvento, obtenerResumenEventos
};
