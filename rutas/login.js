const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/', async (req, res) => {
  const { curp, password } = req.body;

  if (!curp || !password) {
    return res.status(400).json({ error: 'La CURP y la contraseña son obligatorios.' });
  }

  try {
    const db = req.db;

    const curpNormalizada = curp.trim().toUpperCase(); // CURP debe compararse en mayúsculas por convención

    console.log('Buscando usuario con CURP:', curpNormalizada);
    const user = await db.collection('registro').findOne({ curp: curpNormalizada });

    if (!user) {
      console.log('Usuario no encontrado para CURP:', curpNormalizada);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const validRoles = ['atleta', 'club', 'administrador'];
    if (!user.rol || !validRoles.includes(user.rol.toLowerCase())) {
      console.log('Rol inválido para usuario:', user.rol);
      return res.status(400).json({ error: 'Rol no válido o no definido' });
    }

    console.log('Comparando contraseña para usuario:', user.curp);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Contraseña incorrecta para usuario:', user.curp);
      return res.status(401).json({ error: 'Usuario o contraseña incorrecta' });
    }

    console.log('Inicio de sesión exitoso para:', user.curp, 'con rol:', user.rol);
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      tipo: user.rol,
      user: {
        id: user._id.toString(),
        nombre: user.nombre,
        curp: user.curp,
        rol: user.rol,
        gmail: user.gmail,
        telefono: user.telefono,
      },
    });

  } catch (error) {
    console.error('Error al iniciar sesión:', error.message);
    res.status(500).json({ error: 'Error en el servidor. Intenta de nuevo.', details: error.message });
  }
});

module.exports = router;
