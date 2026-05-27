//src/routes/clubes.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/clubes.controller');

router.get('/',                          controller.obtenerTodos);
router.post('/',                         controller.crear);
router.get('/estadisticas/generales',    controller.obtenerEstadisticas);
router.get('/:id',                       controller.obtenerPorId);
router.put('/:id',                       controller.actualizar);
router.delete('/:id',                    controller.eliminar);
router.post('/:id/atletas',              controller.asociarAtletas);
router.delete('/:id/atletas/:atletaId',  controller.desasociarAtleta);

module.exports = router;