// ============================================================
// utils/seed.js — Poblar la base de datos con datos de prueba
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Evento = require('../models/Evento');
const Asistente = require('../models/Asistente');

async function seed() {
  const uri = process.env.MONGODB_URI;
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!uri || !adminEmail || !adminPassword) {
    console.error('[Seed] Define MONGODB_URI, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[Seed] El seed de demostración no puede ejecutarse en producción');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('[Seed] Conectado a MongoDB...');

    // 1. Crear o reutilizar Admin de prueba
    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await Admin.hashearPassword(adminPassword);
      admin = await Admin.create({
        nombre: 'Admin Demo',
        email: adminEmail,
        passwordHash
      });
      console.log(`[Seed] Admin de demostración creado: ${adminEmail}`);
    } else {
      console.log(`[Seed] Admin de demostración existente: ${adminEmail}`);
    }

    // 2. Crear Evento demo si no existe
    let evento = await Evento.findOne({ creador: admin._id, titulo: 'Conferencia de Innovación Tech 2026' });
    if (!evento) {
      const fechaEvento = new Date();
      fechaEvento.setDate(fechaEvento.getDate() + 15);
      fechaEvento.setHours(9, 0, 0, 0);

      evento = await Evento.create({
        creador: admin._id,
        titulo: 'Conferencia de Innovación Tech 2026',
        fecha: fechaEvento,
        lugar: 'Centro de Convenciones Latam — Sala A',
        aforoTotal: 150,
        registrados: 0
      });
      console.log(`[Seed] Evento creado: "${evento.titulo}" (ID: ${evento._id})`);
    } else {
      console.log(`[Seed] Evento existente: "${evento.titulo}" (ID: ${evento._id})`);
    }

    // 3. Crear Asistentes demo
    const asistentesDemo = [
      { nombre: 'Laura Valentina Gómez', cedula: '1020304050', correo: 'laura.gomez@empresa.com', empresa: 'Tech Corp' },
      { nombre: 'Andrés Felipe Martínez', cedula: '1098765432', correo: 'andres.martinez@latam.io', empresa: 'Startup Studio' },
      { nombre: 'Camila Sofía Rincón', cedula: '1152436789', correo: 'camila.rincon@innovacion.co', empresa: 'Agencia Digital' }
    ];

    for (const datos of asistentesDemo) {
      const existe = await Asistente.findOne({ evento: evento._id, cedula: datos.cedula });
      if (!existe) {
        await Asistente.create({
          evento: evento._id,
          nombre: datos.nombre,
          cedula: datos.cedula,
          correo: datos.correo,
          empresa: datos.empresa
        });
        await Evento.updateOne({ _id: evento._id }, { $inc: { registrados: 1 } });
        console.log(`[Seed] Asistente registrado: ${datos.nombre}`);
      }
    }

    console.log('\n[Seed] ¡Población de datos completada con éxito!');
    console.log(`Admin de demostración: ${adminEmail}`);
    console.log(`ID del Evento: ${evento._id}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error al poblar datos:', error);
    process.exit(1);
  }
}

seed();
