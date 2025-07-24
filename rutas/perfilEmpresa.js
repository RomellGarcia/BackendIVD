const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

// POST /api/perfilEmpresa - Crear un nuevo perfil
router.post('/', async (req, res) => {
  const { nombreEmpresa, eslogan, direccion, correo, telefono, facebook, instagram, twitter, mostrarWhatsapp } = req.body;

  // Validación de campos obligatorios
  if (!nombreEmpresa || !eslogan || !direccion || !correo || !telefono) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
  }

  // Validación del teléfono (10 dígitos)
  if (!/^\d{10}$/.test(telefono)) {
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos numéricos' });
  }

  // Validación del correo
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'Introduce un correo electrónico válido' });
  }

  try {
    const db = req.db;

    // Verificar si ya existe un perfil
    const perfilExistente = await db.collection('perfilEmpresa').findOne();
    if (perfilExistente) {
      return res.status(400).json({ error: 'Ya existe un perfil registrado' });
    }

    let logoUrl = '';
    if (req.files && req.files.logo) {
      const file = req.files.logo;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'instituto-veracruzano-deporte/perfil',
      });
      logoUrl = result.secure_url;
    }

    const nuevoPerfil = {
      nombreEmpresa,
      eslogan,
      logo: logoUrl,
      direccion,
      correo,
      telefono,
      facebook: facebook || '', // Opcional, default a cadena vacía
      instagram: instagram || '', // Opcional, default a cadena vacía
      twitter: twitter || '', // Opcional, default a cadena vacía
      mostrarWhatsapp: (typeof mostrarWhatsapp === 'undefined') ? true : (mostrarWhatsapp === true || mostrarWhatsapp === 'true' || mostrarWhatsapp === 1 || mostrarWhatsapp === '1'),
      fechaCreacion: new Date(),
    };

    const result = await db.collection('perfilEmpresa').insertOne(nuevoPerfil);

    if (result.insertedId) {
      console.log(`✅ Perfil guardado con _id: ${result.insertedId}`);
      res.status(201).json({
        message: 'Perfil creado exitosamente',
        perfil: { ...nuevoPerfil, _id: result.insertedId },
      });
    } else {
      throw new Error('Fallo al insertar el perfil en la base de datos');
    }
  } catch (error) {
    console.error('❌ Error al crear el perfil:', error);
    res.status(500).json({
      error: 'No se pudo crear el perfil',
      details: error.message,
    });
  }
});

// GET /api/perfilEmpresa - Obtener el perfil
router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const perfil = await db.collection('perfilEmpresa').findOne();
    if (!perfil) {
      return res.status(200).json({
        nombreEmpresa: 'Instituto Veracruzano del Deporte',
        eslogan: '',
        logo: '',
        direccion: '',
        correo: '',
        telefono: '',
        facebook: '', // Nuevo campo por defecto
        instagram: '', // Nuevo campo por defecto
        twitter: '', // Nuevo campo por defecto
        mostrarWhatsapp: true,
      });
    }
    // Si existe perfil, forzar mostrarWhatsapp a booleano
    if (!('mostrarWhatsapp' in perfil)) {
      perfil.mostrarWhatsapp = true;
    }
    perfil.mostrarWhatsapp = perfil.mostrarWhatsapp === true || perfil.mostrarWhatsapp === 'true' || perfil.mostrarWhatsapp === 1 || perfil.mostrarWhatsapp === '1';
    res.json(perfil);
  } catch (error) {
    console.error('❌ Error al obtener el perfil:', error);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

// PUT /api/perfilEmpresa - Actualizar el perfil
router.put('/', async (req, res) => {
  const { nombreEmpresa, eslogan, direccion, correo, telefono, facebook, instagram, twitter, mostrarWhatsapp } = req.body;

  // Validación de campos obligatorios
  if (!nombreEmpresa || !eslogan || !direccion || !correo || !telefono) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos' });
  }

  // Validación del teléfono
  if (!/^\d{10}$/.test(telefono)) {
    return res.status(400).json({ error: 'El teléfono debe tener exactamente 10 dígitos numéricos' });
  }

  // Validación del correo
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'Introduce un correo electrónico válido' });
  }

  try {
    const db = req.db;
    let logoUrl;
    if (req.files && req.files.logo) {
      const file = req.files.logo;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: 'instituto-veracruzano-deporte/perfil',
      });
      logoUrl = result.secure_url;
    }

    const updateData = {
      nombreEmpresa,
      eslogan,
      direccion,
      correo,
      telefono,
      facebook: facebook || '', // Opcional, default a cadena vacía
      instagram: instagram || '', // Opcional, default a cadena vacía
      twitter: twitter || '', // Opcional, default a cadena vacía
      mostrarWhatsapp: mostrarWhatsapp === true || mostrarWhatsapp === 'true' || mostrarWhatsapp === 1 || mostrarWhatsapp === '1',
      fechaActualizacion: new Date(),
    };
    if (logoUrl) updateData.logo = logoUrl;

    // Buscar el perfil existente
    const perfilExistente = await db.collection('perfilEmpresa').findOne();
    if (!perfilExistente) {
      return res.status(404).json({ error: 'No se encontró un perfil para actualizar' });
    }

    // Convertir _id a ObjectId
    const filter = { _id: new ObjectId(perfilExistente._id) };
    const result = await db.collection('perfilEmpresa').findOneAndUpdate(
      filter,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    // Depuración
    console.log('Resultado de findOneAndUpdate:', result);

    // Verificar si la actualización fue exitosa y obtener el documento actualizado
    if (result.ok === 1 && result.value) {
      res.json({
        message: 'Perfil actualizado exitosamente',
        perfil: result.value,
      });
    } else {
      // Si result.value es null, buscar el documento actualizado directamente
      const updatedPerfil = await db.collection('perfilEmpresa').findOne(filter);
      if (updatedPerfil) {
        res.json({
          message: 'Perfil actualizado exitosamente',
          perfil: updatedPerfil,
        });
      } else {
        throw new Error('No se pudo recuperar el perfil actualizado');
      }
    }
  } catch (error) {
    console.error('❌ Error al actualizar el perfil:', error);
    res.status(500).json({
      error: 'No se pudo actualizar el perfil',
      details: error.message,
    });
  }
});

// DELETE /api/perfilEmpresa - Eliminar el perfil
router.delete('/', async (req, res) => {
  try {
    const db = req.db;
    const perfil = await db.collection('perfilEmpresa').findOne();
    if (!perfil) {
      return res.status(404).json({ error: 'No se encontró un perfil para eliminar' });
    }

    await db.collection('perfilEmpresa').deleteOne();
    res.json({ message: 'Perfil eliminado exitosamente' });
  } catch (error) {
    console.error('❌ Error al eliminar el perfil:', error);
    res.status(500).json({
      error: 'No se pudo eliminar el perfil',
      details: error.message,
    });
  }
});

module.exports = router;