//src/controllers/resultados.controller.js
var Resultado = require('../models/resultado.model');

//POST /api/resultados
function crear(req, res) {
    var eventoId            = req.body.eventoId;
    var convocatoriaIndex   = req.body.convocatoriaIndex;
    var atletaId            = req.body.atletaId;
    var categoria           = req.body.categoria;
    var sexo                = req.body.sexo;
    var municipio           = req.body.municipio;
    var club                = req.body.club;
    var anoCompetitivo      = req.body.añoCompetitivo;
    var pruebas             = req.body.pruebas;
    var entrenadorId        = req.body.entrenadorId;
    var lugarEntrenamiento  = req.body.lugarEntrenamiento;

    if (!eventoId || !atletaId || !categoria) {
        return res.status(400).json({ message: 'Evento, atleta y categoría son obligatorios' });
    }

    //Verificar evento, atleta y entrenador en paralelo
    var promesas = [
        Resultado.verificarEvento(eventoId),
        Resultado.verificarAtleta(atletaId)
    ];
    if (entrenadorId) promesas.push(Resultado.verificarEntrenador(entrenadorId));

    Promise.all(promesas)
        .then(function(resultados) {
            var evento    = resultados[0];
            var atleta    = resultados[1];
            var entrenador = entrenadorId ? resultados[2] : true;

            if (!evento)     throw { status: 404, message: 'Evento no encontrado' };
            if (!atleta)     throw { status: 404, message: 'Atleta no encontrado' };
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };

            return Resultado.crear({
                eventoId,
                convocatoriaIndex,
                atletaId,
                categoria,
                sexo,
                municipio,
                club,
                anoCompetitivo,
                pruebas,
                entrenadorId:        entrenadorId || null,
                lugarEntrenamiento,
                nombreAtleta:  atleta.nombre + ' ' + atleta.apellidopa + ' ' + atleta.apellidoma,
                nombreEvento:  evento.titulo,
                fechaEvento:   evento.fecha
            });
        })
        .then(function(resultado) {
            res.status(201).json(resultado);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('❌ Error al crear resultado:', error);
            res.status(500).json({ message: 'Error al crear resultado', error: error.message });
        });
}

//GET/api/resultados
function obtenerTodos(req, res) {
    Resultado.obtenerConFiltros({
        eventoId:       req.query.eventoId       || null,
        atletaId:       req.query.atletaId       || null,
        categoria:      req.query.categoria      || null,
        club:           req.query.club           || null,
        anoCompetitivo: req.query.añoCompetitivo ? parseInt(req.query.añoCompetitivo, 10) : null,
        limit:          req.query.limit          ? parseInt(req.query.limit, 10) : 100
    })
    .then(function(resultados) { res.json(resultados); })
    .catch(function(error) {
        console.error('Error al obtener resultados:', error);
        res.status(500).json({ message: 'Error al obtener resultados', error: error.message });
    });
}

//GET/api/resultados/:id
function obtenerPorId(req, res) {
    Resultado.obtenerPorId(req.params.id)
        .then(function(resultado) {
            if (!resultado) return res.status(404).json({ message: 'Resultado no encontrado' });
            res.json(resultado);
        })
        .catch(function(error) {
            console.error('Error al obtener resultado:', error);
            res.status(500).json({ message: 'Error al obtener resultado', error: error.message });
        });
}

//PUT/api/resultados/:id
function actualizar(req, res) {
    var id = req.params.id;

    Resultado.obtenerPorId(id)
        .then(function(existente) {
            if (!existente) throw { status: 404, message: 'Resultado no encontrado' };

            var promesas = [];

            //Verificar evento si cambia
            if (req.body.eventoId && req.body.eventoId !== String(existente.evento_id)) {
                promesas.push(
                    Resultado.verificarEvento(req.body.eventoId).then(function(e) {
                        if (!e) throw { status: 404, message: 'Evento no encontrado' };
                    })
                );
            }
            //Verificar atleta si cambia
            if (req.body.atletaId && req.body.atletaId !== String(existente.atleta_id)) {
                promesas.push(
                    Resultado.verificarAtleta(req.body.atletaId).then(function(a) {
                        if (!a) throw { status: 404, message: 'Atleta no encontrado' };
                    })
                );
            }
            //Verificar entrenador si cambia
            if (req.body.entrenadorId && req.body.entrenadorId !== String(existente.entrenador_id)) {
                promesas.push(
                    Resultado.verificarEntrenador(req.body.entrenadorId).then(function(e) {
                        if (!e) throw { status: 404, message: 'Entrenador no encontrado' };
                    })
                );
            }

            return Promise.all(promesas).then(function() { return existente; });
        })
        .then(function(existente) {
            return Resultado.actualizar(id, {
                eventoId:           req.body.eventoId          !== undefined ? req.body.eventoId          : existente.evento_id,
                convocatoriaIndex:  req.body.convocatoriaIndex !== undefined ? req.body.convocatoriaIndex  : existente.convocatoria_index,
                atletaId:           req.body.atletaId          !== undefined ? req.body.atletaId           : existente.atleta_id,
                categoria:          req.body.categoria         !== undefined ? req.body.categoria          : existente.categoria,
                sexo:               req.body.sexo              !== undefined ? req.body.sexo               : existente.sexo,
                municipio:          req.body.municipio         !== undefined ? req.body.municipio          : existente.municipio,
                club:               req.body.club              !== undefined ? req.body.club               : existente.club,
                anoCompetitivo:     req.body.añoCompetitivo    !== undefined ? req.body.añoCompetitivo      : existente.ano_competitivo,
                pruebas:            req.body.pruebas           !== undefined ? req.body.pruebas            : existente.pruebas,
                entrenadorId:       req.body.entrenadorId      !== undefined ? req.body.entrenadorId       : existente.entrenador_id,
                lugarEntrenamiento: req.body.lugarEntrenamiento !== undefined ? req.body.lugarEntrenamiento : existente.lugar_entrenamiento
            });
        })
        .then(function(actualizado) {
            if (!actualizado) return res.status(404).json({ message: 'Resultado no encontrado' });
            res.json(actualizado);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error al actualizar resultado:', error);
            res.status(500).json({ message: 'Error al actualizar resultado', error: error.message });
        });
}

//DELETE/api/resultados/:id
function eliminar(req, res) {
    Resultado.eliminar(req.params.id)
        .then(function(eliminado) {
            if (!eliminado) return res.status(404).json({ message: 'Resultado no encontrado' });
            res.json({ message: 'Resultado eliminado correctamente' });
        })
        .catch(function(error) {
            console.error('Error al eliminar resultado:', error);
            res.status(500).json({ message: 'Error al eliminar resultado', error: error.message });
        });
}

//GET/api/resultados/evento/:eventoId
function obtenerPorEvento(req, res) {
    Resultado.obtenerPorEvento(req.params.eventoId)
        .then(function(resultados) { res.json(resultados); })
        .catch(function(error) {
            console.error('Error al obtener resultados del evento:', error);
            res.status(500).json({ message: 'Error al obtener resultados del evento', error: error.message });
        });
}

//GET/api/resultados/atleta/:atletaId
function obtenerPorAtleta(req, res) {
    Resultado.obtenerPorAtleta(req.params.atletaId)
        .then(function(resultados) { res.json(resultados); })
        .catch(function(error) {
            console.error('Error al obtener resultados del atleta:', error);
            res.status(500).json({ message: 'Error al obtener resultados del atleta', error: error.message });
        });
}

//GET/api/resultados/club/:clubId
function obtenerPorClub(req, res) {
    var clubId = req.params.clubId;

    Resultado.verificarClub(clubId)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            console.log('Club encontrado:', club.nombre);
            return Resultado.obtenerPorClub(clubId);
        })
        .then(function(resultados) {
            console.log('Resultados encontrados para el club:', resultados.length);
            res.json(resultados);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error al obtener resultados del club:', error);
            res.status(500).json({ message: 'Error al obtener resultados del club', error: error.message });
        });
}

//GET/api/resultados/entrenador/:entrenadorId
function obtenerPorEntrenador(req, res) {
    var entrenadorId = req.params.entrenadorId;

    Resultado.verificarEntrenador(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
            return Resultado.obtenerPorEntrenador(entrenadorId);
        })
        .then(function(resultados) {
            console.log('Resultados encontrados para el entrenador:', resultados.length);
            res.json(resultados);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('Error al obtener resultados del entrenador:', error);
            res.status(500).json({ message: 'Error al obtener resultados del entrenador', error: error.message });
        });
}

//GET/api/resultados/estadisticas/generales
function estadisticasGenerales(req, res) {
    Resultado.estadisticasGenerales()
        .then(function(stats) { res.json(stats); })
        .catch(function(error) {
            console.error('❌ Error al obtener estadísticas:', error);
            res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
        });
}

//GET/api/resultados/estadisticas/club/:clubId
function estadisticasPorClub(req, res) {
    Resultado.verificarClub(req.params.clubId)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            return Resultado.estadisticasPorClub(club.nombre);
        })
        .then(function(stats) { res.json(stats); })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ message: error.message });
            console.error('❌ Error al obtener estadísticas del club:', error);
            res.status(500).json({ message: 'Error al obtener estadísticas del club', error: error.message });
        });
}

//GET/api/resultados/debug/clubes
function debugClubes(req, res) {
    Resultado.debugClubes()
        .then(function(datos) { res.json(datos); })
        .catch(function(error) {
            console.error('Error en debug:', error);
            res.status(500).json({ message: 'Error en debug', error: error.message });
        });
}

module.exports = {
    crear,
    obtenerTodos,
    obtenerPorId,
    actualizar,
    eliminar,
    obtenerPorEvento,
    obtenerPorAtleta,
    obtenerPorClub,
    obtenerPorEntrenador,
    estadisticasGenerales,
    estadisticasPorClub,
    debugClubes
};