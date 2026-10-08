// ============================================================
// models/Asistente.js — Asistente registrado a un evento y su check-in
// ============================================================

const mongoose = require('mongoose');
const crypto = require('crypto');

const asistenteSchema = new mongoose.Schema(
  {
    evento: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evento',
      required: true,
      index: true,
      alias: 'eventoId'
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: 3
    },
    cedula: {
      type: String,
      required: [true, 'La cédula es obligatoria'],
      trim: true
    },
    correo: {
      type: String,
      required: [true, 'El correo es obligatorio'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido'],
      alias: 'email'
    },
    empresa: {
      type: String,
      trim: true,
      default: ''
    },
    pin: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    fechaRegistro: {
      type: Date,
      default: Date.now
    },
    estadoCheckin: {
      type: Boolean,
      default: false
    },
    fechaCheckin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Garantiza la unicidad a nivel de base de datos
asistenteSchema.index({ evento: 1, cedula: 1 }, { unique: true });

// El PIN es la referencia pública y debe ser único en toda la colección.
asistenteSchema.index({ pin: 1 }, { unique: true });

// El PIN aleatorio permite consultar un pase sin depender de la sesión del admin.
asistenteSchema.pre('validate', function (next) {
  if (!this.pin) {
    this.pin = `EP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Asistente', asistenteSchema);
