// ============================================================
// models/Evento.js — Evento gestionado por un admin
// ============================================================

const mongoose = require('mongoose');

const eventoSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      required: [true, 'El título del evento es obligatorio'],
      trim: true,
      alias: 'nombre'
    },
    fecha: {
      type: Date,
      required: [true, 'La fecha del evento es obligatoria']
    },
    lugar: {
      type: String,
      required: [true, 'El lugar del evento es obligatorio'],
      trim: true,
      alias: 'ubicacion'
    },
    aforoTotal: {
      type: Number,
      required: [true, 'El aforo total es obligatorio'],
      min: 1,
      alias: 'capacidad'
    },
    creador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true,
      alias: 'adminId'
    },
    registrados: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

module.exports = mongoose.model('Evento', eventoSchema);
