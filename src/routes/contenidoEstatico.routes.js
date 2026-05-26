var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/contenidoEstatico.controller');

router.get('/',     ctrl.listar);
router.post('/',    ctrl.crear);
router.get('/:id',  ctrl.obtenerPorId);
router.put('/:id',  ctrl.actualizar);
router.delete('/:id', ctrl.eliminar);

module.exports = router;
