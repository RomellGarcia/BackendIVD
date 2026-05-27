//src/routes/sesiones.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/sesiones.controller');

//Rutas fijas
router.post('/crear',                     controller.crear);
router.get('/entrenador/:entrenadorId',   controller.obtenerPorEntrenador);
router.get('/club/:clubId',               controller.obtenerPorClub);
router.get('/atleta/:atletaId',           controller.obtenerPorAtleta);

//Rutas con parámetro
router.get('/:sesionId',    controller.obtenerPorId);
router.put('/:sesionId',    controller.actualizar);
router.delete('/:sesionId', controller.eliminar);

module.exports = router;