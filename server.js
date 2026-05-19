const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2;
const bcrypt = require('bcrypt');

// Cargar variables de entorno PRIMERO
dotenv.config();

// Crear la aplicación Express
const app = express();

//CONFIGURACIÓN CORS CORREGIDA
const corsOptions = {
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://127.0.0.1:3000',
    'https://front-ivd.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Aplicar CORS UNA SOLA VEZ
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar fileUpload para manejar archivos
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Crear instancia del cliente
const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function startServer() {
  try {
    await client.connect();
    db = client.db(); // Esto usa la base de datos especificada en la URI
    console.log('Conectado a MongoDB - IVDbd');

    await db.collection('registro').createIndex({ curp: 1 }, { unique: true });

    // Middleware para inyectar db
    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Importar rutas
    const recuperarPassword = require('./rutas/recuperarPassword');
    const registro = require('./rutas/registros');
    const login = require('./rutas/login');
    const perfilEmpresa = require('./rutas/perfilEmpresa');
    const terminos = require('./rutas/terminos');
    const mision = require('./rutas/mision');
    const vision = require('./rutas/vision');
    const politicas = require('./rutas/politicas');
    const eventos = require('./rutas/eventos');
    const clubes = require('./rutas/clubes');
    const resultados = require('./rutas/resultados');
    const entrenador = require('./rutas/entrenador');
    const entrenadores = require('./rutas/entrenadores');
    
    // Configurar rutas
    app.use('/api/registros', registro);
    app.use('/api/login', login);
    app.use('/api/perfilEmpresa', perfilEmpresa);
    app.use('/api/terminos', terminos);
    app.use('/api/mision', mision);
    app.use('/api/vision', vision);
    app.use('/api/politicas', politicas);
    app.use('/api/eventos', eventos);
    app.use('/api/clubes', clubes);
    app.use('/api/resultados', resultados);
    app.use('/api/entrenador', entrenador);
    app.use('/api/entrenadores', entrenadores);
    app.use('/api/recuperar', recuperarPassword);
    
    // Ruta de prueba CORS
    app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Servidor funcionando correctamente', 
        cors: 'Configurado correctamente',
        timestamp: new Date().toISOString()
      });
    });

    app.get('/', (req, res) => {
      res.send('Servidor conectado a MongoDB y funcionando 🚀');
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log(`Prueba CORS: http://localhost:${PORT}/api/test`);
      console.log(`CORS permitiendo orígenes:`, corsOptions.origin);
    });
  } catch (error) {
    console.error('No se pudo conectar a MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  await client.close();
  console.log('Conexión a MongoDB cerrada');
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.close();
  console.log('Conexión a MongoDB cerrada');
  process.exit(0);
});