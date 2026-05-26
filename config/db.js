const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(function() {
        console.log('Conectado a PostgreSQL - Supabase');
    })
    .catch(function(err) {
        console.error('Error de conexión:', err);
    });

module.exports = pool;