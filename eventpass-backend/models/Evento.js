// ============================================================
// models/Evento.js — Evento gestionado por un admin
// ============================================================

const mongoose = require('mongoose');

const eventoSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del evento es obligatorio'],
      trim: true
    },
    fecha: {
      type: Date,
      required: [true, 'La fecha del evento es obligatoria']
    },
    ubicacion: {
      type: String,
      trim: true,
      default: ''
    },
    capacidad: {
      type: Number,
      default: 300,
      min: 1
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Evento', eventoSchema);
