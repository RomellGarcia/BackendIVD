var pool   = require('../config/db');
var bcrypt = require('bcrypt');

// POST /api/login
// Soporta: atleta (por CURP), club (por email), entrenador/administrador (por correo o CURP)
function login(req, res) {
    var rol      = req.body.rol;
    var curp     = req.body.curp;
    var correo   = req.body.correo;
    var password = req.body.password;

    if (!rol || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    if (rol === 'atleta' && !curp) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }
    if ((rol === 'club' || rol === 'entrenador' || rol === 'administrador') && !correo) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    var promesaUsuario;

    if (rol === 'atleta') {
        promesaUsuario = pool.query(
            `SELECT u.*, g.nombre AS sexo_nombre, r.nombre AS rol_nombre, a.club_id
             FROM usuarios u
             LEFT JOIN generos g ON u.genero_id = g.id
             LEFT JOIN roles r ON u.rol_id = r.id
             LEFT JOIN atletas a ON u.id = a.usuario_id
             WHERE u.curp = $1`,
            [curp]
        ).then(function(result) { return result.rows[0] || null; });

    } else if (rol === 'club') {
        promesaUsuario = pool.query(
            'SELECT * FROM clubes WHERE email = $1',
            [correo]
        ).then(function(result) { return result.rows[0] || null; });

    } else if (rol === 'entrenador') {
        promesaUsuario = pool.query(
            `SELECT u.*, g.nombre AS sexo_nombre, r.nombre AS rol_nombre,
                    e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS estado_entrenador,
                    json_agg(DISTINCT cert.nombre) FILTER (WHERE cert.nombre IS NOT NULL) AS certificaciones,
                    json_agg(DISTINCT esp.nombre)  FILTER (WHERE esp.nombre IS NOT NULL)  AS especialidades
             FROM usuarios u
             LEFT JOIN generos g ON u.genero_id = g.id
             LEFT JOIN roles r ON u.rol_id = r.id
             LEFT JOIN entrenadores e ON u.id = e.usuario_id
             LEFT JOIN certificaciones cert ON e.id = cert.entrenador_id
             LEFT JOIN especialidades esp ON e.id = esp.entrenador_id
             WHERE u.email = $1 AND LOWER(r.nombre) = 'entrenador'
             GROUP BY u.id, g.nombre, r.nombre, e.id, e.club_id, e.anos_experiencia, e.estado`,
            [correo]
        ).then(function(result) {
            if (result.rows[0]) return result.rows[0];
            // Intentar por CURP si no encontró por correo
            if (!curp) return null;
            return pool.query(
                `SELECT u.*, g.nombre AS sexo_nombre, r.nombre AS rol_nombre,
                        e.id AS entrenador_id, e.club_id, e.anos_experiencia, e.estado AS estado_entrenador
                 FROM usuarios u
                 LEFT JOIN generos g ON u.genero_id = g.id
                 LEFT JOIN roles r ON u.rol_id = r.id
                 LEFT JOIN entrenadores e ON u.id = e.usuario_id
                 WHERE u.curp = $1 AND LOWER(r.nombre) = 'entrenador'`,
                [curp]
            ).then(function(r2) { return r2.rows[0] || null; });
        });

    } else if (rol === 'administrador') {
        promesaUsuario = pool.query(
            `SELECT u.*, r.nombre AS rol_nombre
             FROM usuarios u
             LEFT JOIN roles r ON u.rol_id = r.id
             WHERE u.email = $1 AND LOWER(r.nombre) = 'administrador'`,
            [correo]
        ).then(function(result) {
            if (result.rows[0]) return result.rows[0];
            if (!curp) return null;
            return pool.query(
                `SELECT u.*, r.nombre AS rol_nombre FROM usuarios u
                 LEFT JOIN roles r ON u.rol_id = r.id
                 WHERE u.curp = $1 AND LOWER(r.nombre) = 'administrador'`,
                [curp]
            ).then(function(r2) { return r2.rows[0] || null; });
        });

    } else {
        return res.status(400).json({ error: 'Rol no válido.' });
    }

    promesaUsuario
        .then(function(user) {
            if (!user) return Promise.reject({ status: 404, error: 'Usuario no encontrado' });
            return bcrypt.compare(password, user.password).then(function(match) {
                if (!match) return Promise.reject({ status: 401, error: 'Usuario o contraseña incorrecta' });
                return user;
            });
        })
        .then(function(user) {
            // Construir respuesta según rol (igual que el original)
            var respuesta = {
                message: 'Inicio de sesión exitoso',
                tipo: rol,
                user: {
                    id: user.id ? user.id.toString() : user._id,
                    nombre: user.nombre,
                    curp: user.curp,
                    gmail: user.email,
                    telefono: user.telefono,
                    rol: rol
                }
            };

            if (rol === 'atleta') {
                respuesta.user.fechaNacimiento = user.fecha_nacimiento;
                respuesta.user.sexo           = user.sexo_nombre;
                respuesta.user.apellidopa     = user.apellido_paterno;
                respuesta.user.apellidoma     = user.apellido_materno;
                respuesta.user.clubId         = user.club_id;
            }

            if (rol === 'club') {
                respuesta.user.direccion   = user.direccion;
                respuesta.user.descripcion = user.descripcion;
                respuesta.user.estado      = user.estado;
            }

            if (rol === 'entrenador') {
                respuesta.user.certificaciones  = user.certificaciones || [];
                respuesta.user.especialidades   = user.especialidades  || [];
                respuesta.user.añosExperiencia  = user.anos_experiencia;
                respuesta.user.clubId           = user.club_id;
                respuesta.user.estado           = user.estado_entrenador;
            }

            res.status(200).json(respuesta);
        })
        .catch(function(err) {
            if (err.status) return res.status(err.status).json({ error: err.error });
            res.status(500).json({ error: 'Error en el servidor.', details: err.message });
        });
}

module.exports = { login };
