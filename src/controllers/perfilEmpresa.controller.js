//src/controllers/perfilEmpresa.controller.js
var cloudinary = require('cloudinary').v2;
var Perfil     = require('../models/perfilEmpresa.model');

//Helpers

var PERFIL_DEFAULT = {
    nombreEmpresa:   'Instituto Veracruzano del Deporte',
    eslogan:         '',
    logo:            '',
    direccion:       '',
    correo:          '',
    telefono:        '',
    facebook:        '',
    instagram:       '',
    twitter:         '',
    mostrarWhatsapp: true
};

function normalizarBooleano(valor) {
    return valor === true || valor === 'true' || valor === 1 || valor === '1';
}

function validarCampos(body) {
    var nombreEmpresa = body.nombreEmpresa;
    var eslogan       = body.eslogan;
    var direccion     = body.direccion;
    var correo        = body.correo;
    var telefono      = body.telefono;

    if (!nombreEmpresa || !eslogan || !direccion || !correo || !telefono) {
        return 'Todos los campos obligatorios deben estar completos';
    }
    if (!/^\d{10}$/.test(telefono)) {
        return 'El teléfono debe tener exactamente 10 dígitos numéricos';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        return 'Introduce un correo electrónico válido';
    }
    return null;
}

function subirLogo(req) {
    if (!req.files || !req.files.logo) return Promise.resolve(null);

    return cloudinary.uploader.upload(req.files.logo.tempFilePath, {
        folder: 'instituto-veracruzano-deporte/perfil'
    }).then(function(result) { return result.secure_url; });
}

function normalizarPerfil(perfil) {
    perfil.mostrarWhatsapp = normalizarBooleano(perfil.mostrar_whatsapp);
    return perfil;
}

//POST/api/perfilEmpresa
function crear(req, res) {
    var errorValidacion = validarCampos(req.body);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    Perfil.existe()
        .then(function(existe) {
            if (existe) throw { status: 400, message: 'Ya existe un perfil registrado' };
            return subirLogo(req);
        })
        .then(function(logoUrl) {
            return Perfil.crear({
                nombreEmpresa:   req.body.nombreEmpresa,
                eslogan:         req.body.eslogan,
                logo:            logoUrl || '',
                direccion:       req.body.direccion,
                correo:          req.body.correo,
                telefono:        req.body.telefono,
                facebook:        req.body.facebook,
                instagram:       req.body.instagram,
                twitter:         req.body.twitter,
                mostrarWhatsapp: normalizarBooleano(req.body.mostrarWhatsapp !== undefined ? req.body.mostrarWhatsapp : true)
            });
        })
        .then(function(perfil) {
            console.log('Perfil guardado con id:', perfil.id);
            res.status(201).json({
                message: 'Perfil creado exitosamente',
                perfil:  normalizarPerfil(perfil)
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al crear el perfil:', error);
            res.status(500).json({ error: 'No se pudo crear el perfil', details: error.message });
        });
}

//GET/api/perfilEmpresa
function obtener(req, res) {
    Perfil.obtener()
        .then(function(perfil) {
            if (!perfil) return res.status(200).json(PERFIL_DEFAULT);
            res.json(normalizarPerfil(perfil));
        })
        .catch(function(error) {
            console.error('Error al obtener el perfil:', error);
            res.status(500).json({ error: 'Error al obtener el perfil' });
        });
}

//PUT/api/perfilEmpresa
function actualizar(req, res) {
    var errorValidacion = validarCampos(req.body);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    Perfil.existe()
        .then(function(existe) {
            if (!existe) throw { status: 404, message: 'No se encontró un perfil para actualizar' };
            return subirLogo(req);
        })
        .then(function(logoUrl) {
            var datos = {
                nombreEmpresa:   req.body.nombreEmpresa,
                eslogan:         req.body.eslogan,
                direccion:       req.body.direccion,
                correo:          req.body.correo,
                telefono:        req.body.telefono,
                facebook:        req.body.facebook,
                instagram:       req.body.instagram,
                twitter:         req.body.twitter,
                mostrarWhatsapp: normalizarBooleano(req.body.mostrarWhatsapp)
            };
            if (logoUrl) datos.logo = logoUrl;
            return Perfil.actualizar(datos);
        })
        .then(function(perfil) {
            res.json({
                message: 'Perfil actualizado exitosamente',
                perfil:  normalizarPerfil(perfil)
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al actualizar el perfil:', error);
            res.status(500).json({ error: 'No se pudo actualizar el perfil', details: error.message });
        });
}

//DELETE/api/perfilEmpresa
function eliminar(req, res) {
    Perfil.obtener()
        .then(function(perfil) {
            if (!perfil) throw { status: 404, message: 'No se encontró un perfil para eliminar' };
            return Perfil.eliminar();
        })
        .then(function() {
            res.json({ message: 'Perfil eliminado exitosamente' });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error al eliminar el perfil:', error);
            res.status(500).json({ error: 'No se pudo eliminar el perfil', details: error.message });
        });
}

module.exports = { crear, obtener, actualizar, eliminar };