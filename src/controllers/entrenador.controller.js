// src/controllers/entrenador.controller.js
var Entrenador = require('../models/entrenador.model');

//GET/api/entrenador/stats/:id
function obtenerStats(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };

            var promesaAtletas = entrenador.club_id
                ? Entrenador.obtenerAtletasPorClub(entrenador.club_id)
                : Promise.resolve([]);

            return Promise.all([
                promesaAtletas,
                Entrenador.contarEventosProximos()
            ]);
        })
        .then(function(resultados) {
            var atletas          = resultados[0];
            var eventosProximos  = resultados[1];

            res.json({
                totalAtletas:     atletas.length,
                atletasActivos:   atletas.length,
                eventosProximos:  eventosProximos,
                sesionesEsteMes:  0
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener estadísticas del entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//GET/api/entrenador/activity/:id
function obtenerActividad(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
            return Entrenador.obtenerEventosProximos(5);
        })
        .then(function(eventos) {
            var actividad = eventos.map(function(evento) {
                return {
                    tipo:        'evento',
                    titulo:      evento.nombre,
                    descripcion: 'Evento: ' + evento.nombre + ' - ' + evento.lugar,
                    fecha:       evento.fecha
                };
            });

            actividad.sort(function(a, b) {
                return new Date(b.fecha) - new Date(a.fecha);
            });

            res.json(actividad);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener actividad del entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//GET/api/entrenador/atletas/:id
function obtenerAtletas(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
            if (!entrenador.club_id) return [];
            return Entrenador.obtenerAtletasPorClub(entrenador.club_id);
        })
        .then(function(atletas) {
            res.json(atletas);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener atletas del entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor', details: error.message });
        });
}

//GET api/entrenador/debug/:id
function debug(req, res) {
    var entrenadorId = req.params.id;
    var entrenadorGuardado;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
            entrenadorGuardado = entrenador;

            var promesas = [Promise.resolve(null), Promise.resolve([])];

            if (entrenador.club_id) {
                promesas[0] = Entrenador.obtenerClubDelEntrenador(entrenador.club_id);
                promesas[1] = Entrenador.obtenerAtletasPorClub(entrenador.club_id);
            }

            return Promise.all(promesas);
        })
        .then(function(resultados) {
            var club    = resultados[0];
            var atletas = resultados[1];

            return Entrenador.obtenerTodosAtletas().then(function(todosAtletas) {
                res.json({
                    entrenador: {
                        id:      entrenadorGuardado.id,
                        nombre:  entrenadorGuardado.nombre + ' ' + entrenadorGuardado.apellidopa + ' ' + entrenadorGuardado.apellidoma,
                        club_id: entrenadorGuardado.club_id,
                        rol:     entrenadorGuardado.rol
                    },
                    club: club ? { id: club.id, nombre: club.nombre, email: club.email } : null,
                    atletasEnClub:        atletas.length,
                    atletasEnClubDetalle: atletas.map(function(a) {
                        return { id: a.id, nombre: a.nombre + ' ' + a.apellidopa, club_id: a.club_id };
                    }),
                    totalAtletas:   todosAtletas.length,
                    todosLosAtletas: todosAtletas.map(function(a) {
                        return { id: a.id, nombre: a.nombre + ' ' + a.apellidopa, club_id: a.club_id };
                    })
                });
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error en debug:', error);
            res.status(500).json({ error: 'Error interno del servidor', details: error.message });
        });
}

//GET/api/entrenador/verificar-relacion/:id
function verificarRelacion(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };

            return Promise.all([
                Promise.resolve(entrenador),
                Entrenador.obtenerTodosAtletas(),
                Entrenador.obtenerTodosClubes()
            ]);
        })
        .then(function(resultados) {
            var entrenador    = resultados[0];
            var todosAtletas  = resultados[1];
            var todosClubes   = resultados[2];

            var clubId             = entrenador.club_id;
            var atletasConClub     = todosAtletas.filter(function(a) { return !!a.club_id; });
            var atletasSinClub     = todosAtletas.filter(function(a) { return !a.club_id; });
            var atletasMismoClub   = atletasConClub.filter(function(a) { return a.club_id === clubId; });

            res.json({
                entrenador: {
                    id:      entrenador.id,
                    nombre:  entrenador.nombre + ' ' + entrenador.apellidopa,
                    club_id: clubId
                },
                estadisticas: {
                    totalAtletas:      todosAtletas.length,
                    atletasConClub:    atletasConClub.length,
                    atletasSinClub:    atletasSinClub.length,
                    atletasMismoClub:  atletasMismoClub.length,
                    totalClubes:       todosClubes.length
                },
                atletasMismoClub: atletasMismoClub.map(function(a) {
                    return { id: a.id, nombre: a.nombre + ' ' + a.apellidopa, club_id: a.club_id };
                }),
                todosLosAtletas: todosAtletas.map(function(a) {
                    return {
                        id:          a.id,
                        nombre:      a.nombre + ' ' + a.apellidopa,
                        club_id:     a.club_id,
                        mismoClub:   a.club_id === clubId
                    };
                }),
                clubes: todosClubes.map(function(c) {
                    return { id: c.id, nombre: c.nombre };
                })
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('❌ Error al verificar relación:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

// GET /api/entrenador/verificar-estructura
function verificarEstructura(req, res) {
    Promise.all([
        Entrenador.obtenerTodosEntrenadores(),
        Entrenador.obtenerTodosAtletas(),
        Entrenador.obtenerTodosClubes()
    ])
    .then(function(resultados) {
        var entrenadores = resultados[0];
        var atletas      = resultados[1];
        var clubes       = resultados[2];

        res.json({
            totalEntrenadores:      entrenadores.length,
            entrenadoresConClub:    entrenadores.filter(function(e) { return !!e.club_id; }).length,
            totalAtletas:           atletas.length,
            atletasConClub:         atletas.filter(function(a) { return !!a.club_id; }).length,
            totalClubes:            clubes.length,
            entrenadores: entrenadores.map(function(e) {
                return { id: e.id, nombre: e.nombre + ' ' + e.apellidopa, club_id: e.club_id, tieneClub: !!e.club_id };
            }),
            atletas: atletas.map(function(a) {
                return { id: a.id, nombre: a.nombre + ' ' + a.apellidopa, club_id: a.club_id, tieneClub: !!a.club_id };
            }),
            clubes: clubes.map(function(c) {
                return { id: c.id, nombre: c.nombre };
            })
        });
    })
    .catch(function(error) {
        console.error('Error al verificar estructura:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

//POST/api/entrenador/verificar-datos
function verificarDatos(req, res) {
    var entrenadorId = req.body.entrenadorId;
    var clubId       = req.body.clubId;

    Promise.all([
        Entrenador.obtenerPorId(entrenadorId),
        Entrenador.verificarClub(clubId)
    ])
    .then(function(resultados) {
        var entrenador = resultados[0];
        var club       = resultados[1];

        if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
        if (!club)       throw { status: 404, message: 'Club no encontrado' };

        res.json({
            message: 'Datos verificados correctamente',
            entrenador: {
                id:       entrenador.id,
                nombre:   entrenador.nombre + ' ' + entrenador.apellidopa + ' ' + entrenador.apellidoma,
                email:    entrenador.gmail,
                telefono: entrenador.telefono
            },
            club: {
                id:     club.id,
                nombre: club.nombre,
                email:  club.email
            }
        });
    })
    .catch(function(error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error al verificar datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    });
}

//POST/api/entrenador/solicitar-club
function solicitarClub(req, res) {
    var entrenadorId = req.body.entrenadorId;
    var clubId       = req.body.clubId;
    var mensaje      = req.body.mensaje;

    Promise.all([
        Entrenador.obtenerPorId(entrenadorId),
        Entrenador.verificarClub(clubId)
    ])
    .then(function(resultados) {
        var entrenador = resultados[0];
        var club       = resultados[1];

        if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
        if (!club)       throw { status: 404, message: 'Club no encontrado' };

        return Entrenador.existeSolicitudActiva(entrenadorId, clubId)
            .then(function(existente) {
                if (existente) throw { status: 400, message: 'Ya tienes una solicitud activa para este club' };

                return Entrenador.crearSolicitud({
                    entrenadorId:        entrenadorId,
                    clubId:              clubId,
                    mensaje:             mensaje,
                    nombreEntrenador:    entrenador.nombre + ' ' + entrenador.apellidopa + ' ' + entrenador.apellidoma,
                    emailEntrenador:     entrenador.gmail,
                    telefonoEntrenador:  entrenador.telefono
                });
            });
    })
    .then(function(solicitud) {
        res.json({ message: 'Solicitud enviada correctamente', solicitudId: solicitud.id });
    })
    .catch(function(error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error al enviar solicitud:', error);
        res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    });
}

//GET/api/entrenador/solicitudes/:id
function obtenerSolicitudes(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerSolicitudesPorEntrenador(entrenadorId)
        .then(function(solicitudes) { res.json(solicitudes); })
        .catch(function(error) {
            console.error('Error al obtener solicitudes:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//GET/api/entrenador/perfil/:id
function obtenerPerfil(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };

            if (!entrenador.club_id) return res.json({ entrenador: entrenador, club: null });

            return Entrenador.obtenerClubDelEntrenador(entrenador.club_id)
                .then(function(club) {
                    res.json({ entrenador: entrenador, club: club });
                });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener perfil del entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//PUT/api/entrenador/perfil/:id
function actualizarPerfil(req, res) {
    var entrenadorId = req.params.id;

    Entrenador.obtenerPorId(entrenadorId)
        .then(function(entrenador) {
            if (!entrenador) throw { status: 404, message: 'Entrenador no encontrado' };
            return Entrenador.actualizarPerfil(entrenadorId, req.body);
        })
        .then(function(actualizado) {
            if (!actualizado) return res.status(404).json({ error: 'Entrenador no encontrado' });
            res.json({
                success:     true,
                message:     'Perfil actualizado correctamente',
                updatedData: actualizado
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al actualizar perfil del entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

module.exports = {
    obtenerStats,
    obtenerActividad,
    obtenerAtletas,
    debug,
    verificarRelacion,
    verificarEstructura,
    verificarDatos,
    solicitarClub,
    obtenerSolicitudes,
    obtenerPerfil,
    actualizarPerfil
};