//src/controllers/login.controller.js
var bcrypt = require('bcrypt');
var Login  = require('../models/login.model');

//Helpers para construir la respuesta según rol

function camposAtleta(user) {
    return {
        fechaNacimiento: user.fecha_nacimiento,
        sexo:            user.genero_nombre,
        apellidopa:      user.apellido_paterno,
        apellidoma:      user.apellido_materno,
        clubId:          user.club_id
    };
}

function camposClub(user) {
    return {
        direccion:   user.direccion,
        descripcion: user.descripcion,
        estado:      user.estado
    };
}

function camposEntrenador(user) {
    return {
        añosExperiencia: user.anos_experiencia,
        clubId:          user.entrenador_club_id,
        estado:          user.entrenador_estado
    };
}

//Buscar usuario según rol

function buscarUsuario(rol, curp, correo) {
    if (rol === 'atleta') {
        return Login.buscarAtletaPorCurp(curp);
    }

    if (rol === 'club') {
        return Login.buscarClubPorEmail(correo);
    }

    if (rol === 'entrenador' || rol === 'administrador') {
        return Login.buscarUsuarioPorEmail(correo, rol)
            .then(function(user) {
                if (user) return user;
                if (!curp) return null;
                return Login.buscarUsuarioPorCurp(curp, rol);
            });
    }

    return Promise.resolve(null);
}

//POST/api/login

function iniciarSesion(req, res) {
    var rol      = req.body.rol;
    var curp     = req.body.curp;
    var correo   = req.body.correo;
    var password = req.body.password;

    console.log('Datos recibidos:', { rol, curp, correo, password });

    var rolesValidos = ['atleta', 'club', 'entrenador', 'administrador'];

    if (!rol || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    if (!rolesValidos.includes(rol)) {
        return res.status(400).json({ error: 'Rol no válido.' });
    }
    if (rol === 'atleta' && !curp) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    if ((rol === 'club' || rol === 'entrenador' || rol === 'administrador') && !correo) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    buscarUsuario(rol, curp, correo)
        .then(function(user) {
            if (!user) throw { status: 404, message: 'Usuario no encontrado' };

            return bcrypt.compare(password, user.password)
                .then(function(isMatch) {
                    if (!isMatch) throw { status: 401, message: 'Usuario o contraseña incorrecta' };
                    return user;
                });
        })
        .then(function(user) {
            // Campos base — mapeamos columnas reales del schema nuevo
            var userData = {
                id:       user.id,
                nombre:   user.nombre,
                curp:     user.curp,
                // clubs usan 'email', usuarios usan 'email' también
                gmail:    user.email,
                telefono: user.telefono,
                rol:      user.rol_nombre || rol
            };

            if (rol === 'atleta')     Object.assign(userData, camposAtleta(user));
            if (rol === 'club')       Object.assign(userData, camposClub(user));
            if (rol === 'entrenador') Object.assign(userData, camposEntrenador(user));

            res.status(200).json({
                message: 'Inicio de sesión exitoso',
                tipo:    rol,
                user:    userData
            });
        })
        .catch(function(error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error en el servidor. Intenta de nuevo.', details: error.message });
        });
}

module.exports = { iniciarSesion };