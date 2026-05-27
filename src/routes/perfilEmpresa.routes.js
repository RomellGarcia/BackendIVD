//src/routes/perfilEmpresa.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/perfilEmpresa.controller');

router.get('/',    controller.obtener);
router.post('/',   controller.crear);
router.put('/',    controller.actualizar);
router.delete('/', controller.eliminar);

module.exports = router;