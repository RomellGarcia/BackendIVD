// terminos.js
const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Middleware para asegurar que req.db esté disponible
router.use((req, res, next) => {
  if (!req.db) {
    return res.status(500).json({ message: 'Error interno: Base de datos no disponible' });
  }
  next();
});

// GET all terms
router.get('/', async (req, res) => {
  try {
    const terminos = await req.db.collection('terminos').find().sort({ createdAt: -1 }).toArray();
    res.json(terminos);
  } catch (error) {
    console.error('❌ Error al obtener los términos:', error);
    res.status(500).json({ message: 'Error al obtener los términos', error: error.message });
  }
});

// GET a term by ID
router.get('/:id', async (req, res) => {
  try {
    const termino = await req.db.collection('terminos').findOne({ _id: new ObjectId(req.params.id) });
    if (!termino) {
      return res.status(404).json({ message: 'Término no encontrado' });
    }
    res.json(termino);
  } catch (error) {
    console.error('❌ Error al obtener el término:', error);
    res.status(500).json({ message: 'Error al obtener el término', error: error.message });
  }
});

// POST a new term
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    
    // Eliminar todos los términos existentes antes de crear uno nuevo
    await req.db.collection('terminos').deleteMany({});
    
    const nuevoTermino = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('terminos').insertOne(nuevoTermino);
    const terminoGuardado = await req.db.collection('terminos').findOne({ _id: result.insertedId });
    res.status(201).json(terminoGuardado);
  } catch (error) {
    console.error('❌ Error al crear el término:', error);
    res.status(500).json({ message: 'Error al crear el término', error: error.message });
  }
});

// PUT update a term by ID
router.put('/:id', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    const terminoId = new ObjectId(req.params.id);
    const updateData = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      updatedAt: new Date(),
    };
    
    // Primero verificar si el término existe
    const terminoExistente = await req.db.collection('terminos').findOne({ _id: terminoId });
    if (!terminoExistente) {
      return res.status(404).json({ message: 'Término no encontrado' });
    }
    
    // Actualizar el término
    const result = await req.db.collection('terminos').findOneAndUpdate(
      { _id: terminoId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    res.json(result.value);
  } catch (error) {
    console.error('❌ Error al actualizar el término:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al actualizar el término', error: error.message });
  }
});

// DELETE a term by ID
router.delete('/:id', async (req, res) => {
  try {
    const terminoId = new ObjectId(req.params.id);
    const result = await req.db.collection('terminos').findOneAndDelete({ _id: terminoId });
    if (!result.value) {
      return res.status(404).json({ message: 'Término no encontrado' });
    }
    res.json({ message: 'Término eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar el término:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al eliminar el término', error: error.message });
  }
});

module.exports = router;