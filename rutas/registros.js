const express = require('express');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();
const saltRounds = 10;

// POST /api/registros
router.post('/', async (req, res) => {
  const {
    nombre,
    apellidopa,
    apellidoma,
    fechaNacimiento,
    rol,
    telefono,
    gmail,
    password,
    sexo,
    estadoNacimiento,
    curp
  } = req.body;

  // Validación de campos obligatorios
  if (
    !nombre || !apellidopa || !apellidoma ||
    !fechaNacimiento || !rol || !telefono ||
    !gmail || !password || !sexo ||
    !estadoNacimiento || !curp
  ) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  // Validación básica de CURP (18 caracteres alfanuméricos)
  if (!/^[A-Za-z0-9]{18}$/.test(curp)) {
    return res.status(400).json({ error: 'La CURP debe tener exactamente 18 caracteres alfanuméricos' });
  }

  try {
    const db = req.db;

    // Validación para evitar CURPs duplicadas
    const curpExistente = await db.collection('registro').findOne({ curp });
    if (curpExistente) {
      return res.status(400).json({ error: 'La CURP ingresada ya está registrada' });
    }

    // (Opcional) Validar correo electrónico único
    const correoExistente = await db.collection('registro').findOne({ gmail });
    if (correoExistente) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    // Convertir la fecha al formato ISO
    const fechaISO = new Date(fechaNacimiento).toISOString();

    // Crear nuevo usuario
    const nuevoUsuario = {
      curp,
      nombre,
      apellidopa,
      apellidoma,
      fechaNacimiento: fechaISO,
      rol,
      telefono,
      gmail,
      password: await bcrypt.hash(password, saltRounds),
      sexo,
      estadoNacimiento,
      fechaRegistro: new Date(),
    };

    // Guardar en MongoDB
    const result = await db.collection('registro').insertOne(nuevoUsuario);

    if (result.insertedId) {
      console.log(`✅ Usuario guardado con _id: ${result.insertedId}`);
      res.status(201).json({
        message: 'Registro creado exitosamente',
        usuario: { ...nuevoUsuario, _id: result.insertedId },
      });
    } else {
      throw new Error('Fallo al insertar el registro en la base de datos');
    }

  } catch (error) {
    console.error('❌ Error al crear el registro:', error);
    res.status(500).json({
      error: 'No se pudo crear el registro',
      details: error.message,
    });
  }
});

module.exports = router;
