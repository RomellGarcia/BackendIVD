const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = req.db;
    const registros = await db.collection('registro').find().toArray();
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener registros:', error);
    res.status(500).json({ error: 'No se pudieron obtener los registros' });
  }
});

router.post('/', async (req, res) => {
  const { nombre, curp } = req.body; // Cambié correo por curp para consistencia

  if (!nombre || !curp) {
    return res.status(400).json({ error: 'Los campos nombre y CURP son obligatorios' });
  }

  try {
    const db = req.db;

    const nuevoRegistro = {
      nombre,
      curp,
      fecha: new Date(),
    };

    await db.collection('registro').insertOne(nuevoRegistro);
    res.json({ message: 'Registro creado exitosamente', registro: nuevoRegistro });
  } catch (error) {
    console.error('Error al crear el registro:', error);
    res.status(500).json({ error: 'No se pudo crear el registro' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, curp } = req.body;

  if (!nombre || !curp) {
    return res.status(400).json({ error: 'Los campos nombre y CURP son obligatorios' });
  }

  try {
    const db = req.db;

    const result = await db.collection('registro').updateOne(
      { _id: new ObjectId(id) },
      { $set: { nombre, curp } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    res.status(500).json({ error: 'No se pudo actualizar el registro' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.db;

    const result = await db.collection('registro').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    res.json({ message: 'Registro eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    res.status(500).json({ error: 'No se pudo eliminar el registro' });
  }
});

module.exports = router;