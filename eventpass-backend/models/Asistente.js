// ============================================================
// models/Asistente.js — Asistente registrado a un evento y su check-in
// ============================================================

const mongoose = require('mongoose');
const crypto = require('crypto');

const asistenteSchema = new mongoose.Schema(
  {
    eventoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evento',
      required: true,
      index: true
    },
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: 3
    },
    email: {
      type: String,
      required: [true, 'El correo es obligatorio'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido']
    },
    empresa: {
      type: String,
      trim: true,
      default: ''
    },
    qrCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
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
  { timestamps: true }
);

// Un mismo código QR no puede repetirse dentro de un mismo evento
asistenteSchema.index({ eventoId: 1, qrCode: 1 }, { unique: true });

// Genera automáticamente el código QR si no viene definido
asistenteSchema.pre('validate', function (next) {
  if (!this.qrCode) {
    const azar = crypto.randomBytes(4).toString('hex').toUpperCase();
    this.qrCode = `EP-${azar}`;
  }
  next();
});

module.exports = mongoose.model('Asistente', asistenteSchema);
