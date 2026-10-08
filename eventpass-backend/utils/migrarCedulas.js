const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const conectarDB = require('../config/db');
const Asistente = require('../models/Asistente');

const argumentos = process.argv.slice(2);
const aplicar = argumentos.includes('--aplicar');

if (
  argumentos.some((argumento) => !['--aplicar', '--dry-run'].includes(argumento)) ||
  (aplicar && argumentos.includes('--dry-run'))
) {
  console.error('Uso: node utils/migrarCedulas.js [--dry-run | --aplicar]');
  process.exit(1);
}

function normalizarCedula(cedula) {
  return String(cedula || '').replace(/[\s.\-]/g, '').toUpperCase();
}

async function migrarCedulas() {
  try {
    await conectarDB();

    const asistentes = await Asistente.find({})
      .select('_id evento cedula')
      .lean();
    const grupos = new Map();

    for (const asistente of asistentes) {
      const cedulaNormalizada = normalizarCedula(asistente.cedula);
      const clave = `${String(asistente.evento)}:${cedulaNormalizada}`;
      const grupo = grupos.get(clave) || [];
      grupo.push({ ...asistente, cedulaNormalizada });
      grupos.set(clave, grupo);
    }

    const colisiones = [...grupos.values()].filter((grupo) => grupo.length > 1);
    const idsEnColision = new Set(
      colisiones.flatMap((grupo) => grupo.map((asistente) => String(asistente._id)))
    );
    const cambios = asistentes
      .filter((asistente) =>
        !idsEnColision.has(String(asistente._id)) &&
        asistente.cedula !== normalizarCedula(asistente.cedula)
      )
      .map((asistente) => ({
        _id: asistente._id,
        evento: asistente.evento,
        anterior: asistente.cedula,
        nueva: normalizarCedula(asistente.cedula)
      }));

    console.log(`Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);
    console.log(`Colisiones (sin modificar): ${colisiones.length}`);
    console.log(JSON.stringify(colisiones.map((grupo) => ({
      evento: grupo[0].evento,
      cedulaNormalizada: grupo[0].cedulaNormalizada,
      asistentes: grupo.map(({ _id, cedula }) => ({ id: _id, cedula }))
    })), null, 2));
    console.log(`Cédulas que ${aplicar ? 'se actualizarán' : 'cambiarían'}: ${cambios.length}`);
    console.log(JSON.stringify(cambios, null, 2));

    if (aplicar && cambios.length) {
      const resultado = await Asistente.bulkWrite(cambios.map((cambio) => ({
        updateOne: {
          filter: { _id: cambio._id, cedula: cambio.anterior },
          update: { $set: { cedula: cambio.nueva } }
        }
      })));
      console.log(`Actualizados: ${resultado.modifiedCount}; sin cambios concurrentes: ${cambios.length - resultado.matchedCount}.`);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

migrarCedulas().catch((error) => {
  console.error('[Migración de cédulas] Error:', error);
  process.exitCode = 1;
});
