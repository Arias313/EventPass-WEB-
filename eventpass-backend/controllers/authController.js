// ============================================================
// controllers/authController.js — Registro y login de admins
// ============================================================

const Admin = require('../models/Admin');
const { generarToken } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const googleClient = new OAuth2Client();

/** POST /api/auth/registro */
async function registrar(req, res, next) {
  try {
    if (process.env.ADMIN_INVITE_CODE) {
      const codigoInvitacion = req.body?.codigoInvitacion;
      const codigoConfigurado = Buffer.from(process.env.ADMIN_INVITE_CODE);
      const codigoRecibido = typeof codigoInvitacion === 'string'
        ? Buffer.from(codigoInvitacion)
        : Buffer.alloc(0);

      if (
        codigoConfigurado.length !== codigoRecibido.length ||
        !crypto.timingSafeEqual(codigoConfigurado, codigoRecibido)
      ) {
        return res.status(403).json({ error: 'Código de invitación inválido.' });
      }
    }

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

/** POST /api/auth/google — Login y auto-registro con Google Identity Services */
async function loginGoogle(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Falta el token de Google (idToken).' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientId || undefined
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Token de Google no contiene un correo válido.' });
    }

    const email = payload.email.toLowerCase();
    const nombre = payload.name || payload.given_name || email.split('@')[0];
    const empresa = payload.hd ? `Organización ${payload.hd}` : '';

    // 1. Buscar si ya existe el organizador
    let admin = await Admin.findOne({ email });

    // 2. Si no existe, crear la cuenta automáticamente con hash aleatorio seguro
    if (!admin) {
      const passwordAleatorio = crypto.randomBytes(32).toString('hex');
      const passwordHash = await Admin.hashearPassword(passwordAleatorio);
      admin = await Admin.create({
        nombre,
        email,
        empresa,
        passwordHash
      });
    }

    // 3. Emitir token JWT de EventPass
    const token = generarToken(admin._id);
    res.json({ token, admin: admin.toJSON() });
  } catch (error) {
    console.error('[Google Auth Error]', error.message);
    res.status(401).json({ error: 'Token de Google inválido o expirado.' });
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

module.exports = { registrar, login, loginGoogle, perfil };
