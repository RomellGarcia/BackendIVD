//src/controllers/sesiones.controller.js
var Sesion = require('../models/sesion.model');

//POST/api/sesiones/crear
function crear(req, res) {
    var titulo             = req.body.titulo;
    var descripcion        = req.body.descripcion;
    var fechaInicio        = req.body.fechaInicio;
    var duracion           = req.body.duracion;
    var tipoEntrenamiento  = req.body.tipoEntrenamiento;
    var ejercicios         = req.body.ejercicios;
    var intensidad         = req.body.intensidad;
    var materialNecesario  = req.body.materialNecesario;
    var notas              = req.body.notas;
    var entrenadorId       = req.body.entrenadorId;
    var clubId             = req.body.clubId;
    var atletasAsignados   = req.body.atletasAsignados;

    if (!titulo || !fechaInicio || !duracion || !tipoEntrenamiento || !entrenadorId || !clubId) {
        return res.status(400).json({
            success: false,
            message: 'Título, fecha, duración, tipo de entrenamiento, entrenador y club son obligatorios'
        });
    }

    Sesion.crear({
        titulo,
        descripcion,
        fechaInicio,
        duracion,
        tipoEntrenamiento,
        ejercicios,
        intensidad,
        materialNecesario,
        notas,
        entrenadorId,
        clubId,
        atletasAsignados
    })
    .then(function(sesion) {
        res.status(201).json({
            success:  true,
            message:  'Sesión creada exitosamente',
            sesionId: sesion.id
        });
    })
    .catch(function(error) {
        console.error('Error al crear sesión:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear la sesión',
            error:   error.message
        });
    });
}

//GET/api/sesiones/entrenador/:entrenadorId
function obtenerPorEntrenador(req, res) {
    Sesion.obtenerPorEntrenador(req.params.entrenadorId)
        .then(function(sesiones) {
            res.json({ success: true, sesiones: sesiones });
        })
        .catch(function(error) {
            console.error('Error al obtener sesiones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las sesiones',
                error:   error.message
            });
        });
}

//GET/api/sesiones/club/:clubId
function obtenerPorClub(req, res) {
    Sesion.obtenerPorClub(req.params.clubId)
        .then(function(sesiones) {
            res.json({ success: true, sesiones: sesiones });
        })
        .catch(function(error) {
            console.error('Error al obtener sesiones del club:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las sesiones del club',
                error:   error.message
            });
        });
}

//GET/api/sesiones/atleta/:atletaId
function obtenerPorAtleta(req, res) {
    Sesion.obtenerPorAtleta(req.params.atletaId)
        .then(function(sesiones) {
            res.json({ success: true, sesiones: sesiones });
        })
        .catch(function(error) {
            console.error('Error al obtener sesiones del atleta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener las sesiones del atleta',
                error:   error.message
            });
        });
}

//GET/api/sesiones/:sesionId
function obtenerPorId(req, res) {
    Sesion.obtenerPorId(req.params.sesionId)
        .then(function(sesion) {
            if (!sesion) {
                return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
            }
            res.json({ success: true, sesion: sesion });
        })
        .catch(function(error) {
            console.error('Error al obtener sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la sesión',
                error:   error.message
            });
        });
}

//PUT/api/sesiones/:sesionId
function actualizar(req, res) {
    var sesionId = req.params.sesionId;

    Sesion.obtenerPorId(sesionId)
        .then(function(sesion) {
            if (!sesion) throw { status: 404, message: 'Sesión no encontrada' };
            return Sesion.actualizar(sesionId, req.body);
        })
        .then(function(actualizada) {
            if (!actualizada) throw { status: 404, message: 'Sesión no encontrada' };
            res.json({ success: true, message: 'Sesión actualizada exitosamente' });
        })
        .catch(function(error) {
            if (error.status) {
                return res.status(error.status).json({ success: false, message: error.message });
            }
            console.error('Error al actualizar sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar la sesión',
                error:   error.message
            });
        });
}

//DELETE/api/sesiones/:sesionId
function eliminar(req, res) {
    Sesion.eliminar(req.params.sesionId)
        .then(function(eliminada) {
            if (!eliminada) {
                return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
            }
            res.json({ success: true, message: 'Sesión eliminada exitosamente' });
        })
        .catch(function(error) {
            console.error('Error al eliminar sesión:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar la sesión',
                error:   error.message
            });
        });
}

module.exports = {
    crear,
    obtenerPorEntrenador,
    obtenerPorClub,
    obtenerPorAtleta,
    obtenerPorId,
    actualizar,
    eliminar
};