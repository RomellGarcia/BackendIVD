var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/perfilEmpresa.controller');

router.get('/',    ctrl.obtener);
router.post('/',   ctrl.crear);
router.put('/',    ctrl.actualizar);
router.delete('/', ctrl.eliminar);

module.exports = router;
