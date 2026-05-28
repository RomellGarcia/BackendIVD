// src/models/resultado.model.js
// NOTA: en el schema real, resultados solo tiene FKs.
// Las "pruebas" son filas en la tabla pruebas_resultado.
// categoria, genero, disciplina → FKs a sus tablas catalogo.
var pool = require('../config/db');

// ── Helper: resultado con JOIN completo ───────────────────────────────────────

var SELECT_RESULTADO = `
    SELECT
        res.*,
        e.titulo         AS nombre_evento,
        e.fecha          AS fecha_evento,
        u.nombre         AS nombre_atleta,
        u.apellido_paterno AS apellido_paterno_atleta,
        u.apellido_materno AS apellido_materno_atleta,
        cat.nombre       AS categoria_nombre,
        g.nombre         AS genero_nombre,
        d.nombre         AS disciplina_nombre,
        ue.nombre        AS nombre_entrenador
    FROM resultados res
    JOIN eventos e       ON e.id   = res.evento_id
    JOIN atletas a       ON a.id   = res.atleta_id
    JOIN usuarios u      ON u.id   = a.usuario_id
    LEFT JOIN categorias cat ON cat.id = res.categoria_id
    LEFT JOIN generos g      ON g.id   = res.genero_id
    LEFT JOIN disciplinas d  ON d.id   = res.disciplina_id
    LEFT JOIN entrenadores en ON en.id = res.entrenador_id
    LEFT JOIN usuarios ue    ON ue.id  = en.usuario_id
`;

function obtenerPruebasDeResultado(resultadoId) {
    return pool.query(
        'SELECT * FROM pruebas_resultado WHERE resultado_id = $1', [resultadoId]
    ).then(function(r) { return r.rows; });
}

function adjuntarPruebas(resultado) {
    if (!resultado) return Promise.resolve(null);
    return obtenerPruebasDeResultado(resultado.id).then(function(pruebas) {
        resultado.pruebas = pruebas;
        return resultado;
    });
}

function adjuntarPruebasLista(resultados) {
    return Promise.all(resultados.map(adjuntarPruebas));
}

// ── Verificaciones ────────────────────────────────────────────────────────────

function verificarEvento(eventoId) {
    return pool.query('SELECT id, titulo, fecha FROM eventos WHERE id = $1', [eventoId])
        .then(function(r) { return r.rows[0] || null; });
}

function verificarAtleta(atletaId) {
    return pool.query(
        `SELECT a.id, u.nombre, u.apellido_paterno, u.apellido_materno
         FROM atletas a JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.id = $1`,
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function verificarEntrenador(entrenadorId) {
    return pool.query('SELECT id FROM entrenadores WHERE id = $1', [entrenadorId])
        .then(function(r) { return r.rows[0] || null; });
}

function verificarClub(clubId) {
    return pool.query('SELECT id, nombre FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return r.rows[0] || null; });
}

// Helpers para resolver FKs por nombre
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

function obtenerDisciplinaId(nombre) {
    if (!nombre) return Promise.resolve(null);
    return pool.query('SELECT id FROM disciplinas WHERE LOWER(nombre) = LOWER($1)', [nombre])
        .then(function(r) { return r.rows[0] ? r.rows[0].id : null; });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function crear(datos) {
    return Promise.all([
        obtenerCategoriaId(datos.categoria),
        obtenerGeneroId(datos.sexo || datos.genero),
        obtenerDisciplinaId(datos.disciplina)
    ]).then(function(ids) {
        return pool.query(
            `INSERT INTO resultados
                (evento_id, atleta_id, entrenador_id, categoria_id, genero_id,
                 disciplina_id, ano_competitivo, fecha_registro)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
             RETURNING *`,
            [
                datos.eventoId,
                datos.atletaId,
                datos.entrenadorId || null,
                ids[0],
                ids[1],
                ids[2],
                datos.anoCompetitivo || new Date().getFullYear()
            ]
        );
    })
    .then(function(r) {
        var resultado = r.rows[0];
        if (!datos.pruebas || datos.pruebas.length === 0) return adjuntarPruebas(resultado);

        var promesas = datos.pruebas.map(function(p) {
            return pool.query(
                'INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad) VALUES ($1,$2,$3,$4)',
                [resultado.id, p.nombre, p.marca, p.unidad]
            );
        });
        return Promise.all(promesas).then(function() { return adjuntarPruebas(resultado); });
    });
}

function obtenerPorId(id) {
    return pool.query(SELECT_RESULTADO + ' WHERE res.id = $1', [id])
        .then(function(r) { return adjuntarPruebas(r.rows[0] || null); });
}

function obtenerConFiltros(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.eventoId)       { condiciones.push('res.evento_id = $'    + idx++); params.push(filtro.eventoId); }
    if (filtro.atletaId)       { condiciones.push('res.atleta_id = $'    + idx++); params.push(filtro.atletaId); }
    if (filtro.anoCompetitivo) { condiciones.push('res.ano_competitivo=$'+ idx++); params.push(filtro.anoCompetitivo); }

    var where  = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    params.push(filtro.limit || 100);

    return pool.query(
        SELECT_RESULTADO + where + ' ORDER BY res.fecha_registro DESC LIMIT $' + idx,
        params
    ).then(function(r) { return adjuntarPruebasLista(r.rows); });
}

function obtenerPorEvento(eventoId) {
    return pool.query(SELECT_RESULTADO + ' WHERE res.evento_id = $1 ORDER BY res.fecha_registro DESC', [eventoId])
        .then(function(r) { return adjuntarPruebasLista(r.rows); });
}

function obtenerPorAtleta(atletaId) {
    return pool.query(SELECT_RESULTADO + ' WHERE res.atleta_id = $1 ORDER BY res.fecha_registro DESC', [atletaId])
        .then(function(r) { return adjuntarPruebasLista(r.rows); });
}

function obtenerPorClub(clubId) {
    return pool.query(
        SELECT_RESULTADO + ' WHERE a.club_id = $1 ORDER BY res.fecha_registro DESC', [clubId]
    ).then(function(r) { return adjuntarPruebasLista(r.rows); });
}

function obtenerPorEntrenador(entrenadorId) {
    return pool.query(
        SELECT_RESULTADO + ' WHERE res.entrenador_id = $1 ORDER BY res.fecha_registro DESC', [entrenadorId]
    ).then(function(r) { return adjuntarPruebasLista(r.rows); });
}

function actualizar(id, datos) {
    return Promise.all([
        obtenerCategoriaId(datos.categoria),
        obtenerGeneroId(datos.sexo || datos.genero),
        obtenerDisciplinaId(datos.disciplina)
    ]).then(function(ids) {
        var campos = [];
        var params = [];
        var idx    = 1;

        if (datos.eventoId)       { campos.push('evento_id = $'       + idx++); params.push(datos.eventoId); }
        if (datos.atletaId)       { campos.push('atleta_id = $'       + idx++); params.push(datos.atletaId); }
        if (datos.entrenadorId !== undefined) { campos.push('entrenador_id = $' + idx++); params.push(datos.entrenadorId); }
        if (datos.anoCompetitivo) { campos.push('ano_competitivo = $' + idx++); params.push(datos.anoCompetitivo); }
        if (ids[0] !== null)      { campos.push('categoria_id = $'   + idx++); params.push(ids[0]); }
        if (ids[1] !== null)      { campos.push('genero_id = $'      + idx++); params.push(ids[1]); }
        if (ids[2] !== null)      { campos.push('disciplina_id = $'  + idx++); params.push(ids[2]); }

        if (campos.length === 0) return obtenerPorId(id);

        params.push(id);
        return pool.query(
            'UPDATE resultados SET ' + campos.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
            params
        ).then(function(r) {
            if (!r.rows[0]) return null;

            if (datos.pruebas) {
                return pool.query('DELETE FROM pruebas_resultado WHERE resultado_id = $1', [id])
                    .then(function() {
                        var promesas = datos.pruebas.map(function(p) {
                            return pool.query(
                                'INSERT INTO pruebas_resultado (resultado_id, nombre, marca, unidad) VALUES ($1,$2,$3,$4)',
                                [id, p.nombre, p.marca, p.unidad]
                            );
                        });
                        return Promise.all(promesas);
                    })
                    .then(function() { return obtenerPorId(id); });
            }

            return obtenerPorId(id);
        });
    });
}

function eliminar(id) {
    return pool.query('DELETE FROM pruebas_resultado WHERE resultado_id = $1', [id])
        .then(function() {
            return pool.query('DELETE FROM resultados WHERE id = $1 RETURNING id', [id]);
        })
        .then(function(r) { return r.rows[0] || null; });
}

function estadisticasGenerales() {
    return pool.query(
        `SELECT
            COUNT(*)                    AS total_resultados,
            COUNT(DISTINCT evento_id)   AS total_eventos,
            COUNT(DISTINCT atleta_id)   AS total_atletas,
            COUNT(DISTINCT entrenador_id) AS total_entrenadores
         FROM resultados`
    ).then(function(r) { return r.rows[0] || {}; });
}

function estadisticasPorClub(clubId) {
    return pool.query(
        `SELECT
            COUNT(res.*)                      AS total_resultados,
            COUNT(DISTINCT res.atleta_id)     AS total_atletas,
            COUNT(DISTINCT res.evento_id)     AS total_eventos
         FROM resultados res
         JOIN atletas a ON a.id = res.atleta_id
         WHERE a.club_id = $1`,
        [clubId]
    ).then(function(r) { return r.rows[0] || {}; });
}

function debugClubes() {
    return Promise.all([
        pool.query('SELECT * FROM clubes ORDER BY nombre ASC'),
        pool.query(`SELECT res.id, u.nombre AS nombre_atleta, a.club_id
                    FROM resultados res
                    JOIN atletas a ON a.id = res.atleta_id
                    JOIN usuarios u ON u.id = a.usuario_id
                    ORDER BY res.fecha_registro DESC`)
    ]).then(function(r) {
        return {
            clubes:          r[0].rows,
            resultados:      r[1].rows,
            totalClubes:     r[0].rows.length,
            totalResultados: r[1].rows.length
        };
    });
}

module.exports = {
    verificarEvento, verificarAtleta, verificarEntrenador, verificarClub,
    obtenerCategoriaId, obtenerGeneroId, obtenerDisciplinaId,
    crear, obtenerPorId, obtenerConFiltros, obtenerPorEvento, obtenerPorAtleta,
    obtenerPorClub, obtenerPorEntrenador, actualizar, eliminar,
    estadisticasGenerales, estadisticasPorClub, debugClubes
};
