//src/models/resultado.model.js
var pool = require('../config/db');

//Helpers internos
function parsearPruebas(resultado) {
    if (!resultado) return resultado;
    if (resultado.pruebas && typeof resultado.pruebas === 'string') {
        try { resultado.pruebas = JSON.parse(resultado.pruebas); } catch (e) { resultado.pruebas = []; }
    }
    return resultado;
}

//Verificaciones
function verificarEvento(eventoId) {
    return pool.query('SELECT id, titulo, fecha FROM eventos WHERE id = $1', [eventoId])
        .then(function(r) { return r.rows[0] || null; });
}

function verificarAtleta(atletaId) {
    return pool.query(
        "SELECT id, nombre, apellidopa, apellidoma FROM registros WHERE id = $1 AND rol = 'atleta'",
        [atletaId]
    ).then(function(r) { return r.rows[0] || null; });
}

function verificarEntrenador(entrenadorId) {
    return pool.query(
        "SELECT id FROM registros WHERE id = $1 AND rol = 'entrenador'",
        [entrenadorId]
    ).then(function(r) { return r.rows[0] || null; });
}

function verificarClub(clubId) {
    return pool.query('SELECT id, nombre FROM clubes WHERE id = $1', [clubId])
        .then(function(r) { return r.rows[0] || null; });
}

//CRUD
function crear(datos) {
    return pool.query(
        `INSERT INTO resultados
            (evento_id, convocatoria_index, atleta_id, categoria, sexo, municipio,
             club, club_id, ano_competitivo, pruebas, entrenador_id, lugar_entrenamiento,
             nombre_atleta, nombre_evento, fecha_evento, fecha_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
         RETURNING *`,
        [
            datos.eventoId,
            datos.convocatoriaIndex || 0,
            datos.atletaId,
            datos.categoria,
            datos.sexo             || 'no especificado',
            datos.municipio        || '',
            datos.club             || '',
            datos.clubId           || null,
            datos.anoCompetitivo   || new Date().getFullYear(),
            JSON.stringify(datos.pruebas || []),
            datos.entrenadorId     || null,
            datos.lugarEntrenamiento || '',
            datos.nombreAtleta,
            datos.nombreEvento,
            datos.fechaEvento
        ]
    ).then(function(r) { return parsearPruebas(r.rows[0]); });
}

function obtenerPorId(id) {
    return pool.query('SELECT * FROM resultados WHERE id = $1', [id])
        .then(function(r) { return parsearPruebas(r.rows[0] || null); });
}

function obtenerConFiltros(filtro) {
    var condiciones = [];
    var params      = [];
    var idx         = 1;

    if (filtro.eventoId)      { condiciones.push('evento_id = $'      + idx++); params.push(filtro.eventoId); }
    if (filtro.atletaId)      { condiciones.push('atleta_id = $'      + idx++); params.push(filtro.atletaId); }
    if (filtro.categoria)     { condiciones.push('categoria = $'      + idx++); params.push(filtro.categoria); }
    if (filtro.club)          { condiciones.push('club = $'           + idx++); params.push(filtro.club); }
    if (filtro.anoCompetitivo){ condiciones.push('ano_competitivo = $'+ idx++); params.push(filtro.anoCompetitivo); }

    var where  = condiciones.length > 0 ? ' WHERE ' + condiciones.join(' AND ') : '';
    var limite = ' LIMIT $' + idx;
    params.push(filtro.limit || 100);

    return pool.query(
        'SELECT * FROM resultados' + where + ' ORDER BY fecha_registro DESC' + limite,
        params
    ).then(function(r) { return r.rows.map(parsearPruebas); });
}

function obtenerPorEvento(eventoId) {
    return pool.query(
        'SELECT * FROM resultados WHERE evento_id = $1 ORDER BY fecha_registro DESC',
        [eventoId]
    ).then(function(r) { return r.rows.map(parsearPruebas); });
}

function obtenerPorAtleta(atletaId) {
    return pool.query(
        'SELECT * FROM resultados WHERE atleta_id = $1 ORDER BY fecha_registro DESC',
        [atletaId]
    ).then(function(r) { return r.rows.map(parsearPruebas); });
}

function obtenerPorClub(clubId) {
    return pool.query(
        'SELECT * FROM resultados WHERE club_id = $1 ORDER BY fecha_registro DESC',
        [clubId]
    ).then(function(r) { return r.rows.map(parsearPruebas); });
}

function obtenerPorEntrenador(entrenadorId) {
    return pool.query(
        'SELECT * FROM resultados WHERE entrenador_id = $1 ORDER BY fecha_registro DESC',
        [entrenadorId]
    ).then(function(r) { return r.rows.map(parsearPruebas); });
}

function actualizar(id, datos) {
    var campos = [];
    var params = [];
    var idx    = 1;

    var mapa = {
        eventoId:           'evento_id',
        convocatoriaIndex:  'convocatoria_index',
        atletaId:           'atleta_id',
        categoria:          'categoria',
        sexo:               'sexo',
        municipio:          'municipio',
        club:               'club',
        anoCompetitivo:     'ano_competitivo',
        entrenadorId:       'entrenador_id',
        lugarEntrenamiento: 'lugar_entrenamiento'
    };

    Object.keys(mapa).forEach(function(campo) {
        if (datos[campo] !== undefined) {
            campos.push(mapa[campo] + ' = $' + idx++);
            params.push(datos[campo]);
        }
    });

    if (datos.pruebas !== undefined) {
        campos.push('pruebas = $' + idx++);
        params.push(JSON.stringify(datos.pruebas));
    }

    campos.push('fecha_actualizacion = NOW()');

    params.push(id);
    return pool.query(
        'UPDATE resultados SET ' + campos.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
        params
    ).then(function(r) { return parsearPruebas(r.rows[0] || null); });
}

function eliminar(id) {
    return pool.query('DELETE FROM resultados WHERE id = $1 RETURNING id', [id])
        .then(function(r) { return r.rows[0] || null; });
}

//Estadísticas
function estadisticasGenerales() {
    return pool.query(
        `SELECT
            COUNT(*)                        AS total_resultados,
            COUNT(DISTINCT evento_id)       AS total_eventos,
            COUNT(DISTINCT atleta_id)       AS total_atletas,
            COUNT(DISTINCT club)            AS total_clubes,
            ARRAY_AGG(DISTINCT categoria)   AS categorias
         FROM resultados`
    ).then(function(r) { return r.rows[0] || {}; });
}

function estadisticasPorClub(nombreClub) {
    return pool.query(
        `SELECT
            COUNT(*)                      AS total_resultados,
            COUNT(DISTINCT atleta_id)     AS total_atletas,
            COUNT(DISTINCT evento_id)     AS total_eventos,
            ARRAY_AGG(DISTINCT categoria) AS categorias
         FROM resultados
         WHERE club = $1`,
        [nombreClub]
    ).then(function(r) { return r.rows[0] || {}; });
}

function debugClubes() {
    return Promise.all([
        pool.query('SELECT * FROM clubes ORDER BY nombre ASC'),
        pool.query('SELECT id, club, nombre_atleta FROM resultados ORDER BY fecha_registro DESC')
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
    verificarEvento,
    verificarAtleta,
    verificarEntrenador,
    verificarClub,
    crear,
    obtenerPorId,
    obtenerConFiltros,
    obtenerPorEvento,
    obtenerPorAtleta,
    obtenerPorClub,
    obtenerPorEntrenador,
    actualizar,
    eliminar,
    estadisticasGenerales,
    estadisticasPorClub,
    debugClubes
};