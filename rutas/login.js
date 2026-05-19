const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/', async (req, res) => {
  const { rol, curp, correo, password } = req.body;
  console.log('🔍 Datos recibidos:', { rol, curp, correo, password });

  if (!rol || !password || (rol === 'atleta' && !curp) || ((rol === 'club' || rol === 'entrenador' || rol === 'administrador') && !correo)) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  try {
    const db = req.db;
    let user;

    if (rol === 'atleta') {
      console.log('🔍 Buscando atleta con CURP:', curp);
      user = await db.collection('registro').findOne({ curp });
      console.log('🔍 Resultado:', user ? `Encontrado: ${user.nombre}` : 'No encontrado');
    } else if (rol === 'club') {
      user = await db.collection('club').findOne({ email: correo });
    } else if (rol === 'entrenador') {
      user = await db.collection('registro').findOne({ gmail: correo, rol: 'entrenador' });
      if (!user && curp) {
        user = await db.collection('registro').findOne({ curp, rol: 'entrenador' });
      }
    } else if (rol === 'administrador') {
      user = await db.collection('registro').findOne({ gmail: correo, rol: 'administrador' });
      if (!user && curp) {
        user = await db.collection('registro').findOne({ curp, rol: 'administrador' });
      }
    } else {
      return res.status(400).json({ error: 'Rol no válido.' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrecta' });
    }

    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      tipo: rol,
      user: {
        id: user._id.toString(),
        nombre: user.nombre,
        curp: user.curp,
        gmail: user.gmail || user.email,
        telefono: user.telefono,
        rol: user.rol,
        ...(rol === 'atleta' && {
          fechaNacimiento: user.fechaNacimiento,
          sexo: user.sexo,
          apellidopa: user.apellidopa,
          apellidoma: user.apellidoma,
          clubId: user.clubId
        }),
        ...(rol === 'club' && {
          direccion: user.direccion,
          entrenador: user.entrenador,
          descripcion: user.descripcion,
          estado: user.estado
        }),
        ...(rol === 'entrenador' && {
          certificaciones: user.certificaciones,
          especialidades: user.especialidades,
          añosExperiencia: user.añosExperiencia,
          clubId: user.clubId,
          estado: user.estado
        })
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor. Intenta de nuevo.', details: error.message });
  }
});

module.exports = router;