var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/resultados.controller');

// Rutas específicas ANTES de las paramétricas
router.get('/estadisticas/generales',    ctrl.estadisticasGenerales);
router.get('/estadisticas/club/:clubId', ctrl.estadisticasClub);
router.get('/evento/:eventoId',          ctrl.porEvento);
router.get('/atleta/:atletaId',          ctrl.porAtleta);
router.get('/club/:clubId',              ctrl.porClub);
router.get('/entrenador/:entrenadorId',  ctrl.porEntrenador);

// CRUD general
router.get('/',       ctrl.listar);
router.post('/',      ctrl.crear);
router.get('/:id',    ctrl.obtener);
router.put('/:id',    ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;