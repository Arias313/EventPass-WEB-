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

    // Sin Client ID no se puede validar la audiencia: se aceptarían tokens emitidos
    // para cualquier otra app de Google. Se rechaza en lugar de verificar a medias.
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[Google Auth] GOOGLE_CLIENT_ID no está configurado; login con Google deshabilitado.');
      return res.status(503).json({ error: 'El inicio de sesión con Google no está disponible en este momento.' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch (errorVerificacion) {
      console.error('[Google Auth Error]', errorVerificacion.message);
      return res.status(401).json({ error: 'Token de Google inválido o expirado.' });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Token de Google no contiene un correo válido.' });
    }

    // Solo se confía en correos verificados por Google: evita tomar cuentas
    // existentes con un correo que el usuario de Google no controla.
    if (payload.email_verified !== true) {
      return res.status(403).json({ error: 'Tu correo de Google no está verificado.' });
    }

    const email = payload.email.toLowerCase();

    // 1. Buscar si ya existe el organizador
    let admin = await Admin.findOne({ email });

    // 2. Si no existe, crear la cuenta automáticamente con hash aleatorio seguro,
    //    salvo que el registro de admins esté restringido por código de invitación.
    if (!admin) {
      if (process.env.ADMIN_INVITE_CODE) {
        return res.status(403).json({
          error: 'El registro de organizadores requiere un código de invitación. ' +
            'Crea tu cuenta con el formulario de registro; después podrás entrar con Google.'
        });
      }

      const nombre = payload.name || payload.given_name || email.split('@')[0];
      const empresa = payload.hd ? `Organización ${payload.hd}` : '';
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

module.exports = { registrar, login, loginGoogle, perfil };
