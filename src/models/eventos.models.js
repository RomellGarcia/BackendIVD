//src/models/evento.model.js
var pool = require('../config/db');

//Eventos

function obtenerTodos(limite) {
    var query = 'SELECT * FROM eventos WHERE estado != false ORDER BY created_at DESC';
    var params = [];

    if (limite) {
        query += ' LIMIT $1';
        params.push(limite);
    }

    return pool.query(query, params)
        .then(function(result) { return result.rows; });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM eventos WHERE id = $1', [id])
        .then(function(result) { return result.rows[0] || null; });
}

function crearEvento(datos) {
    return pool.query(
        `INSERT INTO eventos
            (titulo, fecha, hora, lugar, descripcion, fecha_cierre, estado, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         RETURNING *`,
        [
            datos.titulo,
            datos.fecha,
            datos.hora,
            datos.lugar,
            datos.descripcion || '',
            datos.fechaCierre
        ]
    ).then(function(result) { return result.rows[0]; });
}

function actualizarFechaCierre(id, fechaCierre) {
    return pool.query(
        'UPDATE eventos SET fecha_cierre = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [fechaCierre, id]
    ).then(function(result) { return result.rows[0] || null; });
}

//Convocatorias
function crearConvocatoria(eventoId, conv) {
    return pool.query(
        `INSERT INTO convocatorias
            (evento_id, disciplina, categoria, genero, para_personas, edad_min, edad_max, estado, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
         RETURNING *`,
        [
            eventoId,
            conv.disciplina.trim(),
            conv.categoria.trim(),
            conv.genero.trim(),
            (conv.paraPersonas || conv.genero).trim(),
            parseInt(conv.edadMin, 10),
            parseInt(conv.edadMax, 10)
        ]
    ).then(function(result) { return result.rows[0]; });
}

function obtenerConvocatoriasPorEvento(eventoId) {
    return pool.query(
        'SELECT * FROM convocatorias WHERE evento_id = $1 AND estado = true',
        [eventoId]
    ).then(function(result) { return result.rows; });
}

function obtenerEventoConConvocatorias(eventoId) {
    return Promise.all([
        obtenerPorId(eventoId),
        obtenerConvocatoriasPorEvento(eventoId)
    ]).then(function(resultados) {
        var evento = resultados[0];
        if (!evento) return null;
        evento.convocatorias = resultados[1];
        return evento;
    });
}

//Convocatorias abiertas que aplican para la edad y género de un atleta
function obtenerConvocatoriasParaAtleta(edad, genero) {
    return pool.query(
        `SELECT
            e.id,
            e.titulo,
            e.fecha,
            e.hora,
            e.lugar,
            e.descripcion,
            e.fecha_cierre,
            e.estado,
            c.id           AS convocatoria_id,
            c.disciplina,
            c.categoria,
            c.edad_min,
            c.edad_max,
            c.genero,
            c.para_personas
         FROM eventos e
         INNER JOIN convocatorias c ON c.evento_id = e.id
         WHERE e.fecha_cierre > NOW()
           AND e.estado = true
           AND c.estado = true
           AND c.edad_min <= $1
           AND c.edad_max >= $1
           AND (c.genero = $2 OR c.genero = 'mixto')
         ORDER BY e.fecha ASC`,
        [edad, genero]
    ).then(function(result) { return result.rows; });
}

//Inscripciones

function obtenerAtletaPorId(atletaId) {
    return pool.query(
        'SELECT * FROM registros WHERE id = $1 AND rol = $2',
        [atletaId, 'atleta']
    ).then(function(result) { return result.rows[0] || null; });
}

function existeInscripcion(eventoId, atletaId) {
    return pool.query(
        'SELECT id FROM inscripciones WHERE evento_id = $1 AND atleta_id = $2',
        [eventoId, atletaId]
    ).then(function(result) { return result.rows[0] || null; });
}

function crearInscripcion(datos) {
    return pool.query(
        `INSERT INTO inscripciones
            (evento_id, atleta_id, nombre_completo, edad, genero, validado, fecha_inscripcion)
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         RETURNING *`,
        [
            datos.eventoId,
            datos.atletaId,
            datos.nombreCompleto,
            datos.edad,
            datos.genero
        ]
    ).then(function(result) { return result.rows[0]; });
}

function obtenerInscripciones(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.atletaId) {
        condiciones.push('atleta_id = $' + idx++);
        params.push(filtro.atletaId);
    }
    if (filtro.eventoId) {
        condiciones.push('evento_id = $' + idx++);
        params.push(filtro.eventoId);
    }

    var where = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    return pool.query('SELECT * FROM inscripciones' + where, params)
        .then(function(result) { return result.rows; });
}

function obtenerParticipantesPorEvento(eventoId) {
    return pool.query(
        'SELECT * FROM inscripciones WHERE evento_id = $1 ORDER BY fecha_inscripcion ASC',
        [eventoId]
    ).then(function(result) { return result.rows; });
}

function obtenerResumenEventos() {
    return Promise.all([
        pool.query('SELECT COUNT(*) AS total FROM eventos'),
        pool.query('SELECT COUNT(*) AS total FROM eventos WHERE estado = true'),
        pool.query('SELECT COUNT(*) AS total FROM eventos WHERE estado = true AND fecha_cierre > NOW()'),
        pool.query('SELECT * FROM eventos ORDER BY created_at DESC')
    ]).then(function(resultados) {
        return {
            totalEventos:     parseInt(resultados[0].rows[0].total, 10),
            eventosActivos:   parseInt(resultados[1].rows[0].total, 10),
            eventosAbiertos:  parseInt(resultados[2].rows[0].total, 10),
            detalle:          resultados[3].rows
        };
    });
}

module.exports = {
    obtenerTodos,
    obtenerPorId,
    crearEvento,
    actualizarFechaCierre,
    crearConvocatoria,
    obtenerConvocatoriasPorEvento,
    obtenerEventoConConvocatorias,
    obtenerConvocatoriasParaAtleta,
    obtenerAtletaPorId,
    existeInscripcion,
    crearInscripcion,
    obtenerInscripciones,
    obtenerParticipantesPorEvento,
    obtenerResumenEventos
};