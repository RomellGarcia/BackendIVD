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

// POST /api/resultados - Registrar resultado de un atleta en un evento
router.post('/', async (req, res) => {
  try {
    const {
      eventoId,
      atletaId,
      disciplina,
      categoria,
      tiempo,
      posicion,
      marca,
      observaciones,
      registradoPor // ID del usuario que registra (admin o club)
    } = req.body;

    // Validaciones básicas
    if (!eventoId || !atletaId || !disciplina || !categoria) {
      return res.status(400).json({ message: 'Evento, atleta, disciplina y categoría son requeridos' });
    }

    const db = req.db;

    // Verificar que el evento existe
    const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    // Verificar que el atleta existe
    const atleta = await db.collection('registro').findOne({ _id: new ObjectId(atletaId), rol: 'atleta' });
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }

    // Verificar que el atleta está inscrito en el evento
    const inscripcion = await db.collection('inscripciones').findOne({ 
      eventoId, 
      atletaId 
    });
    if (!inscripcion) {
      return res.status(400).json({ message: 'El atleta no está inscrito en este evento' });
    }

    // Verificar que no existe ya un resultado para este atleta en esta disciplina
    const resultadoExistente = await db.collection('resultados').findOne({
      eventoId,
      atletaId,
      disciplina
    });
    if (resultadoExistente) {
      return res.status(400).json({ message: 'Ya existe un resultado para este atleta en esta disciplina' });
    }

    // Crear el resultado
    const nuevoResultado = {
      eventoId,
      atletaId,
      disciplina,
      categoria,
      tiempo: tiempo || null,
      posicion: posicion || null,
      marca: marca || null,
      observaciones: observaciones || '',
      registradoPor,
      fechaRegistro: new Date(),
      nombreAtleta: `${atleta.nombre} ${atleta.apellidopa} ${atleta.apellidoma}`,
      nombreEvento: evento.titulo,
      fechaEvento: evento.fecha
    };

    const result = await db.collection('resultados').insertOne(nuevoResultado);
    const resultadoGuardado = await db.collection('resultados').findOne({ _id: result.insertedId });

    res.status(201).json(resultadoGuardado);
  } catch (error) {
    console.error('❌ Error al registrar resultado:', error);
    res.status(500).json({ message: 'Error al registrar resultado', error: error.message });
  }
});

// GET /api/resultados - Obtener resultados con filtros
router.get('/', async (req, res) => {
  try {
    const {
      eventoId,
      atletaId,
      disciplina,
      categoria,
      clubId,
      limit = 50,
      sort = 'fechaRegistro'
    } = req.query;

    const db = req.db;
    const filtro = {};

    if (eventoId) filtro.eventoId = eventoId;
    if (atletaId) filtro.atletaId = atletaId;
    if (disciplina) filtro.disciplina = disciplina;
    if (categoria) filtro.categoria = categoria;

    // Si se filtra por club, obtener atletas del club primero
    if (clubId) {
      const atletasClub = await db.collection('registro').find({ 
        clubId, 
        rol: 'atleta' 
      }).toArray();
      const atletaIds = atletasClub.map(a => a._id.toString());
      filtro.atletaId = { $in: atletaIds };
    }

    const resultados = await db.collection('resultados')
      .find(filtro)
      .sort({ [sort]: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados:', error);
    res.status(500).json({ message: 'Error al obtener resultados', error: error.message });
  }
});

// GET /api/resultados/atleta/:atletaId - Obtener resultados de un atleta específico
router.get('/atleta/:atletaId', async (req, res) => {
  try {
    const db = req.db;
    const { atletaId } = req.params;

    // Verificar que el atleta existe
    const atleta = await db.collection('registro').findOne({ 
      _id: new ObjectId(atletaId), 
      rol: 'atleta' 
    });
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }

    const resultados = await db.collection('resultados')
      .find({ atletaId })
      .sort({ fechaEvento: -1 })
      .toArray();

    res.json(resultados);
  } catch (error) {
    console.error('❌ Error al obtener resultados del atleta:', error);
    res.status(500).json({ message: 'Error al obtener resultados del atleta', error: error.message });
  }
});

// GET /api/resultados/evento/:eventoId - Obtener resultados de un evento específico
router.get('/evento/:eventoId', async (req, res) => {
  try {
    const db = req.db;
    const { eventoId } = req.params;

    // Verificar que el evento existe
    const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const resultados = await db.collection('resultados')
      .find({ eventoId })
      .sort({ disciplina: 1, posicion: 1 })
      .toArray();

    // Agrupar por disciplina
    const resultadosAgrupados = {};
    resultados.forEach(resultado => {
      if (!resultadosAgrupados[resultado.disciplina]) {
        resultadosAgrupados[resultado.disciplina] = [];
      }
      resultadosAgrupados[resultado.disciplina].push(resultado);
    });

    res.json({
      evento,
      resultados: resultadosAgrupados
    });
  } catch (error) {
    console.error('❌ Error al obtener resultados del evento:', error);
    res.status(500).json({ message: 'Error al obtener resultados del evento', error: error.message });
  }
});

// PUT /api/resultados/:id - Actualizar resultado
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tiempo,
      posicion,
      marca,
      observaciones
    } = req.body;

    const db = req.db;

    const resultado = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    if (!resultado) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    const updateData = {
      tiempo: tiempo || resultado.tiempo,
      posicion: posicion || resultado.posicion,
      marca: marca || resultado.marca,
      observaciones: observaciones || resultado.observaciones,
      fechaActualizacion: new Date()
    };

    await db.collection('resultados').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    const resultadoActualizado = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    res.json(resultadoActualizado);
  } catch (error) {
    console.error('❌ Error al actualizar resultado:', error);
    res.status(500).json({ message: 'Error al actualizar resultado', error: error.message });
  }
});

// DELETE /api/resultados/:id - Eliminar resultado
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.db;

    const resultado = await db.collection('resultados').findOne({ _id: new ObjectId(id) });
    if (!resultado) {
      return res.status(404).json({ message: 'Resultado no encontrado' });
    }

    await db.collection('resultados').deleteOne({ _id: new ObjectId(id) });
    res.json({ message: 'Resultado eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar resultado:', error);
    res.status(500).json({ message: 'Error al eliminar resultado', error: error.message });
  }
});

// GET /api/resultados/estadisticas/atleta/:atletaId - Estadísticas de un atleta
router.get('/estadisticas/atleta/:atletaId', async (req, res) => {
  try {
    const db = req.db;
    const { atletaId } = req.params;

    const atleta = await db.collection('registro').findOne({ 
      _id: new ObjectId(atletaId), 
      rol: 'atleta' 
    });
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }

    const resultados = await db.collection('resultados')
      .find({ atletaId })
      .sort({ fechaEvento: 1 })
      .toArray();

    // Calcular estadísticas
    const estadisticas = {
      totalEventos: resultados.length,
      disciplinas: {},
      mejorTiempo: null,
      peorTiempo: null,
      promedioTiempo: null,
      podios: 0,
      progreso: []
    };

    if (resultados.length > 0) {
      // Contar podios
      estadisticas.podios = resultados.filter(r => r.posicion && r.posicion <= 3).length;

      // Agrupar por disciplina
      resultados.forEach(resultado => {
        if (!estadisticas.disciplinas[resultado.disciplina]) {
          estadisticas.disciplinas[resultado.disciplina] = {
            total: 0,
            mejorTiempo: null,
            promedioTiempo: null
          };
        }
        estadisticas.disciplinas[resultado.disciplina].total++;
      });

      // Calcular progreso temporal
      estadisticas.progreso = resultados.map(r => ({
        fecha: r.fechaEvento,
        disciplina: r.disciplina,
        tiempo: r.tiempo,
        posicion: r.posicion
      }));
    }

    res.json({
      atleta: {
        nombre: `${atleta.nombre} ${atleta.apellidopa} ${atleta.apellidoma}`,
        edad: calcularEdad(atleta.fechaNacimiento),
        genero: atleta.sexo
      },
      estadisticas
    });
  } catch (error) {
    console.error('❌ Error al obtener estadísticas del atleta:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
});

// Función auxiliar para calcular edad
function calcularEdad(fechaNacimiento) {
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const mes = hoy.getMonth() - fechaNac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad;
}

module.exports = router; 