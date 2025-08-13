const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

dotenv.config();

const app = express();
app.use(express.json());

// Configurar CORS para permitir localhost:3000
app.use(cors({
  origin: ['http://localhost:3000',"https://front-ivd.vercel.app/"],
  credentials: true,
}));




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
    db = client.db();
    console.log('✅ Conectado a MongoDB - IVDbd');

    await db.collection('registro').createIndex({ curp: 1 }, { unique: true });

    app.use((req, res, next) => {
      req.db = db;
      next();
    });

    // Importar rutas
    const recuperarPassword = require('./rutas/recuperarPassword');
    const registro = require('./rutas/registros');
    const login = require('./rutas/login');
    const perfilEmpresa = require('./rutas/perfilEmpresa'); // Nueva ruta
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
    app.use('/api/perfilEmpresa', perfilEmpresa); // Nueva ruta
    app.use('/api/terminos',terminos );
    app.use('/api/mision',mision);
    app.use('/api/vision',vision);
    app.use('/api/politicas',politicas);
    app.use('/api/eventos',eventos);
    app.use('/api/clubes',clubes);
    app.use('/api/resultados', resultados);
    app.use('/api/entrenador', entrenador);
    app.use('/api/entrenadores', entrenadores);
    app.use('/api/recuperar', recuperarPassword);

    
    app.get('/', (req, res) => {
      res.send('Servidor conectado a MongoDB y funcionando 🚀');
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  await client.close();
  console.log('✅ Conexión a MongoDB cerrada');
  process.exit(0);
});

process.on('SIGINT', async () => {
  await client.close();
  console.log('✅ Conexión a MongoDB cerrada');
  process.exit(0);
});