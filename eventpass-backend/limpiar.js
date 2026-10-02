require('dotenv').config();
const mongoose = require('mongoose');

async function limpiarBaseDeDatos() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB...');
    await mongoose.connection.db.dropDatabase();
    console.log('¡Base de datos borrada por completo!');
    process.exit(0);
  } catch (error) {
    console.error('Error al limpiar:', error);
    process.exit(1);
  }
}

limpiarBaseDeDatos();