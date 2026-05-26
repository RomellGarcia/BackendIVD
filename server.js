// server.js — versión final con todas las rutas migradas a PostgreSQL
var express    = require('express');
var dotenv     = require('dotenv');
var cors       = require('cors');
var fileUpload = require('express-fileupload');
var cloudinary = require('cloudinary').v2;

dotenv.config();
require('./config/db'); // Inicializar conexión PostgreSQL

var app = express();

var corsOptions = {
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

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── Rutas ──────────────────────────────────────────────────────────────────
app.use('/api/login',        require('./routes/login.routes'));
app.use('/api/registros',    require('./routes/registros.routes'));
app.use('/api/clubes',       require('./routes/clubes.routes'));
app.use('/api/entrenador',   require('./routes/entrenador.routes'));
app.use('/api/entrenadores', require('./routes/entrenadores.routes'));
app.use('/api/eventos',      require('./routes/eventos.routes'));
app.use('/api/resultados',   require('./routes/resultados.routes'));
app.use('/api/sesiones',     require('./routes/sesiones.routes'));
app.use('/api/recuperar',    require('./routes/recuperarPassword.routes'));
app.use('/api/perfilEmpresa',require('./routes/perfilEmpresa.routes'));

// Contenido estático — todos usan el mismo controller, el tipo se detecta por baseUrl
app.use('/api/mision',       require('./routes/contenidoEstatico.routes'));
app.use('/api/vision',       require('./routes/contenidoEstatico.routes'));
app.use('/api/terminos',     require('./routes/contenidoEstatico.routes'));
app.use('/api/politicas',    require('./routes/contenidoEstatico.routes'));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/test', function(req, res) {
    res.json({ message: 'Servidor IVD con PostgreSQL funcionando 🚀', timestamp: new Date() });
});
app.get('/', function(req, res) {
    res.send('Servidor IVD conectado a PostgreSQL 🚀');
});

var PORT = process.env.PORT || 5000;
app.listen(PORT, function() {
    console.log('Servidor corriendo en http://localhost:' + PORT);
});
