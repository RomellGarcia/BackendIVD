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

// POST /api/eventos - Crear un nuevo evento con convocatorias
router.post('/', async (req, res) => {
  try {
    const {
      titulo,
      fecha,
      hora,
      lugar,
      descripcion,
      convocatorias // Array de convocatorias
    } = req.body;

    // Validaciones básicas
    if (!titulo || !fecha || !hora || !lugar || !convocatorias || !Array.isArray(convocatorias) || convocatorias.length === 0) {
      return res.status(400).json({ message: 'Título, fecha, hora, lugar y al menos una convocatoria son requeridos' });
    }

    // Validar cada convocatoria
    for (let i = 0; i < convocatorias.length; i++) {
      const conv = convocatorias[i];
      if (!conv.disciplina || !conv.categoria || !conv.genero || typeof conv.edadMin === 'undefined' || typeof conv.edadMax === 'undefined') {
        return res.status(400).json({ 
          message: `Convocatoria ${i + 1}: disciplina, categoría, género, edad mínima y máxima son requeridos` 
        });
      }
      
      const edadMinNum = parseInt(conv.edadMin, 10);
      const edadMaxNum = parseInt(conv.edadMax, 10);
      if (isNaN(edadMinNum) || isNaN(edadMaxNum)) {
        return res.status(400).json({ 
          message: `Convocatoria ${i + 1}: La edad mínima y máxima deben ser números válidos` 
        });
      }
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
      convocatorias: convocatorias.map(conv => ({
        ...conv,
        disciplina: conv.disciplina.trim(),
        categoria: conv.categoria.trim(),
        edadMin: parseInt(conv.edadMin, 10),
        edadMax: parseInt(conv.edadMax, 10),
        genero: conv.genero.trim(),
        paraPersonas: (conv.paraPersonas || conv.genero).trim(), // compatibilidad
        estado: true,
        createdAt: new Date()
      })),
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

// POST /api/eventos/:eventoId/convocatorias - Agregar convocatoria a un evento existente
router.post('/:eventoId/convocatorias', async (req, res) => {
  try {
    const { eventoId } = req.params;
    const convocatoria = req.body;

    // Validar que el evento existe
    const evento = await req.db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    // Validar la convocatoria
    if (!convocatoria.disciplina || !convocatoria.categoria || !convocatoria.genero || 
        typeof convocatoria.edadMin === 'undefined' || typeof convocatoria.edadMax === 'undefined') {
      return res.status(400).json({ 
        message: 'Disciplina, categoría, género, edad mínima y máxima son requeridos' 
      });
    }

    const edadMinNum = parseInt(convocatoria.edadMin, 10);
    const edadMaxNum = parseInt(convocatoria.edadMax, 10);
    if (isNaN(edadMinNum) || isNaN(edadMaxNum)) {
      return res.status(400).json({ 
        message: 'La edad mínima y máxima deben ser números válidos' 
      });
    }

    const nuevaConvocatoria = {
      ...convocatoria,
      disciplina: convocatoria.disciplina.trim(),
      categoria: convocatoria.categoria.trim(),
      edadMin: edadMinNum,
      edadMax: edadMaxNum,
      genero: convocatoria.genero.trim(),
      paraPersonas: (convocatoria.paraPersonas || convocatoria.genero).trim(),
      estado: true,
      createdAt: new Date()
    };

    const resultado = await req.db.collection('eventos').updateOne(
      { _id: new ObjectId(eventoId) },
      { 
        $push: { convocatorias: nuevaConvocatoria },
        $set: { updatedAt: new Date() }
      }
    );

    if (resultado.matchedCount === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const eventoActualizado = await req.db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    res.json(eventoActualizado);
  } catch (error) {
    console.error('❌ Error al agregar convocatoria:', error);
    res.status(500).json({ message: 'Error al agregar convocatoria', error: error.message });
  }
});

// GET /api/eventos - Obtener todos los eventos
router.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    
    let query = req.db.collection('eventos').find({
      estado: { $ne: false } // Excluir eventos cancelados
    }).sort({ createdAt: -1 });

    // Aplicar límite si se especifica
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum)) {
        query = query.limit(limitNum);
      }
    }

    const eventos = await query.toArray();
    res.json(eventos);
  } catch (error) {
    console.error('❌ Error al obtener eventos:', error);
    res.status(500).json({ message: 'Error al obtener eventos', error: error.message });
  }
});

// GET /api/eventos/convocatorias-para-atleta?edad=17&genero=masculino
router.get('/convocatorias-para-atleta', async (req, res) => {
  try {
    const edad = Number(req.query.edad);
    const genero = (req.query.genero || '').toLowerCase();
    
    console.log('🔍 Filtrado de convocatorias:', { edad, genero, query: req.query });
    
    if (isNaN(edad) || edad === null || edad === undefined) {
      console.log('❌ Edad inválida:', req.query.edad);
      return res.status(400).json({ message: 'Edad inválida o no proporcionada' });
    }
    
    if (!genero || genero === '') {
      console.log('❌ Género no proporcionado');
      return res.status(400).json({ message: 'Género es requerido' });
    }
    
    const fechaActual = new Date();
    console.log('📅 Fecha actual:', fechaActual);
    
    // Obtener eventos con convocatorias que coincidan
    const eventos = await req.db.collection('eventos').find({
      fechaCierre: { $gt: fechaActual },
      estado: true,
      'convocatorias': {
        $elemMatch: {
          edadMin: { $lte: edad },
          edadMax: { $gte: edad },
          $or: [
            { genero: genero },
            { genero: 'mixto' }
          ],
          estado: true
        }
      }
    }).toArray();
    
    // Transformar para mantener compatibilidad con frontend actual
    const convocatoriasFiltradas = [];
    eventos.forEach(evento => {
      evento.convocatorias.forEach(convocatoria => {
        if (convocatoria.estado && 
            convocatoria.edadMin <= edad && 
            convocatoria.edadMax >= edad &&
            (convocatoria.genero === genero || convocatoria.genero === 'mixto')) {
          
          convocatoriasFiltradas.push({
            _id: evento._id,
            titulo: evento.titulo,
            fecha: evento.fecha,
            hora: evento.hora,
            lugar: evento.lugar,
            descripcion: evento.descripcion,
            disciplina: convocatoria.disciplina,
            categoria: convocatoria.categoria,
            edadMin: convocatoria.edadMin,
            edadMax: convocatoria.edadMax,
            genero: convocatoria.genero,
            paraPersonas: convocatoria.paraPersonas,
            fechaCierre: evento.fechaCierre,
            estado: evento.estado,
            convocatoriaId: convocatoria._id || convocatoria.createdAt?.getTime() // Identificador único de la convocatoria
          });
        }
      });
    });
    
    console.log('📋 Convocatorias encontradas:', convocatoriasFiltradas.length);
    console.log('📋 Detalles de convocatorias:', convocatoriasFiltradas.map(c => ({
      titulo: c.titulo,
      disciplina: c.disciplina,
      edadMin: c.edadMin,
      edadMax: c.edadMax,
      genero: c.genero,
      fechaCierre: c.fechaCierre,
      estado: c.estado
    })));
    
    res.json(convocatoriasFiltradas);
  } catch (error) {
    console.error('❌ Error al filtrar convocatorias para atleta:', error);
    res.status(500).json({ message: 'Error al filtrar convocatorias', error: error.message });
  }
});

// GET /api/eventos/debug-atleta/:atletaId - Debugging para verificar datos del atleta
router.get('/debug-atleta/:atletaId', async (req, res) => {
  try {
    const { atletaId } = req.params;
    const atleta = await req.db.collection('registro').findOne({ _id: new ObjectId(atletaId) });
    
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }
    
    // Calcular edad
    const fechaActual = new Date();
    const fechaNac = new Date(atleta.fechaNacimiento);
    const edad = fechaActual.getFullYear() - fechaNac.getFullYear();
    const mes = fechaActual.getMonth() - fechaNac.getMonth();
    const edadReal = mes < 0 || (mes === 0 && fechaActual.getDate() < fechaNac.getDate()) ? edad - 1 : edad;
    
    const datosDebug = {
      atleta: {
        id: atleta._id,
        nombre: atleta.nombre,
        curp: atleta.curp,
        fechaNacimiento: atleta.fechaNacimiento,
        sexo: atleta.sexo,
        rol: atleta.rol
      },
      calculos: {
        fechaActual: fechaActual,
        fechaNacimiento: fechaNac,
        edadCalculada: edadReal,
        genero: atleta.sexo?.toLowerCase()
      }
    };
    
    console.log('🔍 Debug atleta:', datosDebug);
    res.json(datosDebug);
  } catch (error) {
    console.error('❌ Error en debug atleta:', error);
    res.status(500).json({ message: 'Error al obtener datos del atleta', error: error.message });
  }
});

// GET /api/eventos/debug-eventos - Debugging para verificar todos los eventos
router.get('/debug-eventos', async (req, res) => {
  try {
    const fechaActual = new Date();
    console.log('📅 Fecha actual para debugging:', fechaActual);
    
    // Obtener todos los eventos
    const todosEventos = await req.db.collection('eventos').find({}).toArray();
    
    // Obtener eventos activos
    const eventosActivos = await req.db.collection('eventos').find({ estado: true }).toArray();
    
    // Obtener eventos con fecha de cierre futura
    const eventosAbiertos = await req.db.collection('eventos').find({ 
      fechaCierre: { $gt: fechaActual },
      estado: true 
    }).toArray();
    
    const datosDebug = {
      fechaActual: fechaActual,
      totalEventos: todosEventos.length,
      eventosActivos: eventosActivos.length,
      eventosAbiertos: eventosAbiertos.length,
      todosEventos: todosEventos.map(e => ({
        id: e._id,
        titulo: e.titulo,
        edadMin: e.edadMin,
        edadMax: e.edadMax,
        genero: e.genero,
        fechaCierre: e.fechaCierre,
        estado: e.estado,
        fechaCierrePasada: e.fechaCierre < fechaActual
      })),
      eventosActivosDetalle: eventosActivos.map(e => ({
        id: e._id,
        titulo: e.titulo,
        edadMin: e.edadMin,
        edadMax: e.edadMax,
        genero: e.genero,
        fechaCierre: e.fechaCierre,
        estado: e.estado
      })),
      eventosAbiertosDetalle: eventosAbiertos.map(e => ({
        id: e._id,
        titulo: e.titulo,
        edadMin: e.edadMin,
        edadMax: e.edadMax,
        genero: e.genero,
        fechaCierre: e.fechaCierre,
        estado: e.estado
      }))
    };
    
    console.log('🔍 Debug eventos:', datosDebug);
    res.json(datosDebug);
  } catch (error) {
    console.error('❌ Error en debug eventos:', error);
    res.status(500).json({ message: 'Error al obtener datos de eventos', error: error.message });
  }
});

// PUT /api/eventos/:id/actualizar-fecha-cierre - Actualizar fecha de cierre del evento
router.put('/:id/actualizar-fecha-cierre', async (req, res) => {
  try {
    const { id } = req.params;
    const { fechaCierre } = req.body;
    
    if (!fechaCierre) {
      return res.status(400).json({ message: 'Fecha de cierre es requerida' });
    }
    
    const nuevaFechaCierre = new Date(fechaCierre);
    if (isNaN(nuevaFechaCierre.getTime())) {
      return res.status(400).json({ message: 'Fecha de cierre inválida' });
    }
    
    const resultado = await req.db.collection('eventos').updateOne(
      { _id: new ObjectId(id) },
      { $set: { fechaCierre: nuevaFechaCierre, updatedAt: new Date() } }
    );
    
    if (resultado.matchedCount === 0) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    
    console.log('✅ Fecha de cierre actualizada para evento:', id);
    res.json({ message: 'Fecha de cierre actualizada exitosamente' });
  } catch (error) {
    console.error('❌ Error al actualizar fecha de cierre:', error);
    res.status(500).json({ message: 'Error al actualizar fecha de cierre', error: error.message });
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
    
    // Verificar que el atleta existe
    const atleta = await db.collection('registro').findOne({ _id: new ObjectId(atletaId), rol: 'atleta' });
    if (!atleta) {
      return res.status(404).json({ message: 'Atleta no encontrado' });
    }
    
    // Calcular edad del atleta
    const fechaNac = new Date(atleta.fechaNacimiento);
    const edad = fechaActual.getFullYear() - fechaNac.getFullYear();
    const mes = fechaActual.getMonth() - fechaNac.getMonth();
    const edadReal = mes < 0 || (mes === 0 && fechaActual.getDate() < fechaNac.getDate()) ? edad - 1 : edad;
    
    // Validación de edad
    if (edadReal < evento.edadMin || edadReal > evento.edadMax) {
      return res.status(400).json({ 
        message: `La edad del atleta (${edadReal} años) no cumple con el rango requerido (${evento.edadMin}-${evento.edadMax} años)` 
      });
    }
    
    // Validación de género
    if (evento.genero !== 'mixto' && evento.genero !== atleta.sexo) {
      return res.status(400).json({ 
        message: `El evento es solo para ${evento.genero === 'masculino' ? 'hombres' : 'mujeres'}` 
      });
    }
    
    // Verificar que el atleta no esté ya inscrito
    const yaInscrito = await db.collection('inscripciones').findOne({ eventoId, atletaId });
    if (yaInscrito) {
      return res.status(400).json({ message: 'Ya estás inscrito en este evento' });
    }
    
    // Registrar inscripción con datos validados
    const inscripcion = {
      eventoId,
      atletaId,
      datosAtleta: {
        ...datosAtleta,
        edad: edadReal,
        genero: atleta.sexo,
        nombreCompleto: `${atleta.nombre} ${atleta.apellidopa} ${atleta.apellidoma}`
      },
      fechaInscripcion: fechaActual,
      validado: true
    };
    
    await db.collection('inscripciones').insertOne(inscripcion);
    res.status(201).json({ 
      message: 'Inscripción exitosa', 
      inscripcion,
      validaciones: {
        edad: edadReal,
        genero: atleta.sexo,
        categoria: evento.categoria
      }
    });
  } catch (error) {
    console.error('❌ Error al registrar inscripción:', error);
    res.status(500).json({ message: 'Error al registrar inscripción', error: error.message });
  }
});

// GET /api/eventos/inscripciones?atletaId=...&eventoId=...
router.get('/inscripciones', async (req, res) => {
  try {
    const db = req.db;
    const { atletaId, eventoId } = req.query;
    const filtro = {};
    if (atletaId) filtro.atletaId = atletaId;
    if (eventoId) filtro.eventoId = eventoId;
    const inscripciones = await db.collection('inscripciones').find(filtro).toArray();
    res.json(inscripciones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener inscripciones', error: error.message });
  }
});

// GET /api/eventos/:eventoId/participantes - Obtener participantes de un evento específico
router.get('/:eventoId/participantes', async (req, res) => {
  try {
    const db = req.db;
    const { eventoId } = req.params;
    
    // Verificar que el evento existe
    const evento = await db.collection('eventos').findOne({ _id: new ObjectId(eventoId) });
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    
    // Obtener todas las inscripciones para este evento
    const participantes = await db.collection('inscripciones')
      .find({ eventoId: eventoId })
      .sort({ fechaInscripcion: 1 })
      .toArray();
    
    res.json(participantes);
  } catch (error) {
    console.error('❌ Error al obtener participantes:', error);
    res.status(500).json({ message: 'Error al obtener participantes', error: error.message });
  }
});

module.exports = router;