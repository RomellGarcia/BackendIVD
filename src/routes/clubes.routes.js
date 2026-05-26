var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/clubes.controller');

router.get('/estadisticas/generales',    ctrl.estadisticas);
router.get('/',                          ctrl.listarClubes);
router.post('/',                         ctrl.crearClub);
router.get('/:id',                       ctrl.obtenerClub);
router.put('/:id',                       ctrl.actualizarClub);
router.delete('/:id',                    ctrl.eliminarClub);
router.post('/:id/atletas',              ctrl.asociarAtletas);
router.delete('/:id/atletas/:atletaId',  ctrl.desasociarAtleta);

module.exports = router;
