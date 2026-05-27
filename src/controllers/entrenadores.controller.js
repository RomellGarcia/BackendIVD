//src/controllers/entrenadores.controller.js
var Entrenadores = require('../model/entrenadores.model');

var ESTADOS_VALIDOS = ['pendiente', 'aceptada', 'rechazada'];

//GET/api/entrenadores/club/:clubId
function obtenerPorClub(req, res) {
    var clubId = req.params.clubId;

    Entrenadores.verificarClub(clubId)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            return Entrenadores.obtenerEntrenadoresPorClub(clubId);
        })
        .then(function(entrenadores) {
            res.json(entrenadores);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener entrenadores del club:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//GET/api/entrenadores/solicitudes-club/:clubId
function obtenerSolicitudesPorClub(req, res) {
    var clubId = req.params.clubId;

    Entrenadores.verificarClub(clubId)
        .then(function(club) {
            if (!club) throw { status: 404, message: 'Club no encontrado' };
            return Entrenadores.obtenerSolicitudesPorClub(clubId);
        })
        .then(function(solicitudes) {
            res.json(solicitudes);
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al obtener solicitudes de entrenadores:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//PUT/api/entrenadores/solicitudes/:solicitudId
function actualizarSolicitud(req, res) {
    var solicitudId = req.params.solicitudId;
    var estado      = req.body.estado;

    if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido. Valores permitidos: ' + ESTADOS_VALIDOS.join(', ') });
    }

    Entrenadores.obtenerSolicitudPorId(solicitudId)
        .then(function(solicitud) {
            if (!solicitud) throw { status: 404, message: 'Solicitud no encontrada' };

            //Actualizar estado de la solicitud
            return Entrenadores.actualizarEstadoSolicitud(solicitudId, estado)
                .then(function() {
                    // Si se acepta, asignar entrenador al club
                    if (estado === 'aceptada') {
                        return Entrenadores.asignarEntrenadorAClub(solicitud.entrenador_id, solicitud.club_id);
                    }
                });
        })
        .then(function() {
            res.json({ message: 'Solicitud actualizada correctamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al actualizar solicitud de entrenador:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        });
}

//GET/api/entrenadores/test
function test(req, res) {
    Promise.all([
        Entrenadores.obtenerTablas(),
        Entrenadores.contarSolicitudes(),
        Entrenadores.obtenerSolicitudesRecientes(5)
    ])
    .then(function(resultados) {
        res.json({
            message:           'Test completado',
            tablas:            resultados[0],
            solicitudesCount:  resultados[1],
            solicitudesEjemplo: resultados[2]
        });
    })
    .catch(function(error) {
        console.error('Error en test:', error);
        res.status(500).json({ error: 'Error en test', details: error.message });
    });
}

module.exports = {
    obtenerPorClub,
    obtenerSolicitudesPorClub,
    actualizarSolicitud,
    test
};