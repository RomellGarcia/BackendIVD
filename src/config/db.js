import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err)
  process.exit(-1)
})