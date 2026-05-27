//src/routes/login.routes.js
var express    = require('express');
var router     = express.Router();
var controller = require('../controllers/login.controller');

router.post('/', controller.iniciarSesion);

module.exports = router;