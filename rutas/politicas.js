// rutas/politicas.js
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

// GET /api/politicas - Obtener todas las políticas
router.get('/', async (req, res) => {
  try {
    const politicas = await req.db.collection('politica').find().sort({ createdAt: -1 }).toArray();
    res.json(politicas);
  } catch (error) {
    console.error('❌ Error al obtener las políticas:', error);
    res.status(500).json({ message: 'Error al obtener las políticas', error: error.message });
  }
});

// GET /api/politicas/:id - Obtener una política por ID
router.get('/:id', async (req, res) => {
  try {
    const politica = await req.db.collection('politica').findOne({ _id: new ObjectId(req.params.id) });
    if (!politica) {
      return res.status(404).json({ message: 'Política no encontrada' });
    }
    res.json(politica);
  } catch (error) {
    console.error('❌ Error al obtener la política:', error);
    res.status(500).json({ message: 'Error al obtener la política', error: error.message });
  }
});

// POST /api/politicas - Crear una nueva política
router.post('/', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    
    // Eliminar todas las políticas existentes antes de crear una nueva
    await req.db.collection('politica').deleteMany({});
    
    const nuevaPolitica = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await req.db.collection('politica').insertOne(nuevaPolitica);
    const politicaGuardada = await req.db.collection('politica').findOne({ _id: result.insertedId });
    res.status(201).json(politicaGuardada);
  } catch (error) {
    console.error('❌ Error al crear la política:', error);
    res.status(500).json({ message: 'Error al crear la política', error: error.message });
  }
});

// PUT /api/politicas/:id - Actualizar una política
router.put('/:id', async (req, res) => {
  try {
    const { titulo, contenido } = req.body;
    if (!titulo || !contenido) {
      return res.status(400).json({ message: 'Título y contenido son requeridos' });
    }
    if (titulo.length > 255) {
      return res.status(400).json({ message: 'El título no debe exceder 255 caracteres' });
    }
    const politicaId = new ObjectId(req.params.id);
    const updateData = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      updatedAt: new Date(),
    };
    // Primero verificar si la política existe
    const politicaExistente = await req.db.collection('politica').findOne({ _id: politicaId });
    if (!politicaExistente) {
      return res.status(404).json({ message: 'Política no encontrada' });
    }
    
    // Actualizar la política
    const result = await req.db.collection('politica').findOneAndUpdate(
      { _id: politicaId },
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    res.json(result.value);
  } catch (error) {
    console.error('❌ Error al actualizar la política:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al actualizar la política', error: error.message });
  }
});

// DELETE /api/politicas/:id - Eliminar una política
router.delete('/:id', async (req, res) => {
  try {
    const politicaId = new ObjectId(req.params.id);
    const result = await req.db.collection('politica').findOneAndDelete({ _id: politicaId });
    if (!result.value) {
      return res.status(404).json({ message: 'Política no encontrada' });
    }
    res.json({ message: 'Política eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar la política:', error);
    if (error.name === 'MongoInvalidArgumentError' || error.name === 'BSONError') {
      return res.status(400).json({ message: 'ID inválido', error: error.message });
    }
    res.status(500).json({ message: 'Error al eliminar la política', error: error.message });
  }
});

module.exports = router;