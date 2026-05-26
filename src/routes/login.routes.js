// routes/login.routes.js
var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/login.controller');
router.post('/', ctrl.login);
module.exports = router;
