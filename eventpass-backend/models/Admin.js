// ============================================================
// models/Admin.js — Usuario administrador
// ============================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: 2
    },
    email: {
      type: String,
      required: [true, 'El correo es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido']
    },
    passwordHash: {
      type: String,
      required: true,
      select: false // nunca se devuelve por defecto en las consultas
    }
  },
  { timestamps: true }
);

// ─── Helpers de contraseña ───────────────────────────────────

adminSchema.methods.compararPassword = function (passwordPlano) {
  return bcrypt.compare(passwordPlano, this.passwordHash);
};

adminSchema.statics.hashearPassword = function (passwordPlano) {
  return bcrypt.hash(passwordPlano, 10);
};

// Nunca exponer el hash aunque el documento se serialice a JSON
adminSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Admin', adminSchema);
