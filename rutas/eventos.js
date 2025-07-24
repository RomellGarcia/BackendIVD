// rutas/eventos.js
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

// POST /api/eventos - Crear un nuevo evento
router.post('/', async (req, res) => {
  try {
    const {
      titulo,
      fecha,
      hora,
      lugar,
      descripcion,
      disciplina,
      categoria,
      edadMin,
      edadMax,
      genero, // "masculino", "femenino", "mixto"
      paraPersonas // compatibilidad con frontend actual
    } = req.body;

    // Validaciones básicas
    if (!titulo || !fecha || !hora || !lugar || !disciplina || !categoria || !genero || typeof edadMin === 'undefined' || typeof edadMax === 'undefined') {
      return res.status(400).json({ message: 'Todos los campos son requeridos excepto descripción' });
    }
    const edadMinNum = parseInt(edadMin, 10);
    const edadMaxNum = parseInt(edadMax, 10);
    if (isNaN(edadMinNum) || isNaN(edadMaxNum)) {
      return res.status(400).json({ message: 'La edad mínima y máxima deben ser números válidos.' });
    }

    // Calcular fecha de cierre (24h antes del evento)
    const fechaEvento = new Date(fecha);
    const fechaCierre = new Date(fechaEvento.getTime() - 24 * 60 * 60 * 1000);

    const nuevoEvento = {
      titulo: titulo.trim(),
      fecha: fechaEvento,
      hora: hora.trim(),
      lugar: lugar.trim(),
      descripcion: descripcion ? descripcion.trim() : '',
      disciplina: disciplina.trim(),
      categoria: categoria.trim(),
      edadMin: edadMinNum,
      edadMax: edadMaxNum,
      genero: genero.trim(),
      paraPersonas: (paraPersonas || genero).trim(), // compatibilidad
      fechaCierre,
      estado: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await req.db.collection('eventos').insertOne(nuevoEvento);
    const eventoGuardado = await req.db.collection('eventos').findOne({ _id: result.insertedId });
    res.status(201).json(eventoGuardado);
  } catch (error) {
    console.error('❌ Error al crear el evento:', error);
    res.status(500).json({ message: 'Error al crear el evento', error: error.message });
  }
});

// GET /api/eventos/convocatorias-para-atleta?edad=17&genero=masculino
router.get('/convocatorias-para-atleta', async (req, res) => {
  try {
    const edad = parseInt(req.query.edad, 10);
    const genero = (req.query.genero || '').toLowerCase();
    if (isNaN(edad) || !genero) {
      return res.status(400).json({ message: 'Edad y género son requeridos' });
    }
    const fechaActual = new Date();
    const eventos = await req.db.collection('eventos').find({
      edadMin: { $lte: edad },
      edadMax: { $gte: edad },
      $or: [
        { genero: genero },
        { genero: 'mixto' }
      ],
      fechaCierre: { $gt: fechaActual },
      estado: true
    }).toArray();
    res.json(eventos);
  } catch (error) {
    console.error('❌ Error al filtrar convocatorias para atleta:', error);
    res.status(500).json({ message: 'Error al filtrar convocatorias', error: error.message });
  }
});

// POST /api/inscripciones - Registrar inscripción de atleta a evento
router.post('/inscripciones', async (req, res) => {
  try {
    const { eventoId, atletaId, datosAtleta } = req.body;
    if (!eventoId || !atletaId) {
      return res.status(400).json({ message: 'Evento y atleta son requeridos' });
    }
    const db = req.db;
    // Verificar que el evento existe y está abierto
    const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    const fechaActual = new Date();
    if (fechaActual > evento.fechaCierre) {
      return res.status(400).json({ message: 'La convocatoria ya está cerrada' });
    }
    // Verificar que el atleta no esté ya inscrito
    const yaInscrito = await db.collection('inscripciones').findOne({ eventoId, atletaId });
    if (yaInscrito) {
      return res.status(400).json({ message: 'Ya estás inscrito en este evento' });
    }
    // Registrar inscripción
    const inscripcion = {
      eventoId,
      atletaId,
      datosAtleta: datosAtleta || {},
      fechaInscripcion: fechaActual,
    };
    await db.collection('inscripciones').insertOne(inscripcion);
    res.status(201).json({ message: 'Inscripción exitosa', inscripcion });
  } catch (error) {
    console.error('❌ Error al registrar inscripción:', error);
    res.status(500).json({ message: 'Error al registrar inscripción', error: error.message });
  }
});

module.exports = router;