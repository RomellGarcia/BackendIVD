var express = require('express');
var router  = express.Router();
var ctrl    = require('../controllers/recuperarPassword.controller');

router.post('/forgot-password',  ctrl.forgotPassword);
router.post('/verify-code',      ctrl.verifyCode);
router.post('/reset-password',   ctrl.resetPassword);

module.exports = router;
