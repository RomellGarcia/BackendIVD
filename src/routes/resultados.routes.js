//src/routes/resultados.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/resultados.controller');

//Rutas fijas
router.get('/estadisticas/generales',        controller.estadisticasGenerales);
router.get('/estadisticas/club/:clubId',     controller.estadisticasPorClub);
router.get('/debug/clubes',                  controller.debugClubes);
router.get('/evento/:eventoId',              controller.obtenerPorEvento);
router.get('/atleta/:atletaId',              controller.obtenerPorAtleta);
router.get('/club/:clubId',                  controller.obtenerPorClub);
router.get('/entrenador/:entrenadorId',      controller.obtenerPorEntrenador);

//Rutas generales
router.get('/',     controller.obtenerTodos);
router.post('/',    controller.crear);
router.get('/:id',  controller.obtenerPorId);
router.put('/:id',  controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;