var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/sesiones.controller');

// Rutas específicas ANTES de la paramétrica /:sesionId
router.get('/entrenador/:entrenadorId', ctrl.porEntrenador);
router.get('/club/:clubId',             ctrl.porClub);
router.get('/atleta/:atletaId',         ctrl.porAtleta);

// CRUD
router.post('/crear',        ctrl.crear);
router.get('/:sesionId',     ctrl.obtener);
router.put('/:sesionId',     ctrl.actualizar);
router.delete('/:sesionId',  ctrl.eliminar);

module.exports = router;
