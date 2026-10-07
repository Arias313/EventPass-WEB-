// ============================================================
// controllers/authController.js — Registro y login de admins
// ============================================================

const Admin = require('../models/Admin');
const { generarToken } = require('../middleware/auth');

/** POST /api/auth/registro */
async function registrar(req, res, next) {
  try {
    const { nombre, empresa, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const yaExiste = await Admin.findOne({ email: email.toLowerCase() });
    if (yaExiste) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const passwordHash = await Admin.hashearPassword(password);
    const admin = await Admin.create({ nombre, empresa, email, passwordHash });

    const token = generarToken(admin._id);
    res.status(201).json({ token, admin });
  } catch (error) {
    next(error);
  }
}

/** POST /api/auth/login */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    // .select('+passwordHash') porque el schema lo excluye por defecto
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!admin) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordValido = await admin.compararPassword(password);
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = generarToken(admin._id);
    res.json({ token, admin: admin.toJSON() });
  } catch (error) {
    next(error);
  }
}

/** GET /api/auth/perfil — requiere token */
async function perfil(req, res, next) {
  try {
    const admin = await Admin.findById(req.adminId);
    if (!admin) return res.status(404).json({ error: 'Admin no encontrado.' });
    res.json({ admin });
  } catch (error) {
    next(error);
  }
}

module.exports = { registrar, login, perfil };
