// ============================================================
// config/db.js — Conexión a MongoDB vía Mongoose
// ============================================================

const mongoose = require('mongoose');

async function conectarDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Falta MONGODB_URI en las variables de entorno (.env)');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);

  console.log(`[DB] Conectado a MongoDB → ${mongoose.connection.name}`);

  mongoose.connection.on('error', (error) => {
    console.error('[DB] Error de conexión:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] Desconectado de MongoDB');
  });
}

module.exports = conectarDB;
