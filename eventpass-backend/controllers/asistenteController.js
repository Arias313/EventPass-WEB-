// ============================================================
// controllers/asistenteController.js — Registro, check-in y stats
// ============================================================

const Asistente = require('../models/Asistente');
const Evento = require('../models/Evento');

/**
 * Helper puro: confirma que el evento existe y pertenece al admin autenticado.
 * No depende de `res`, así se puede reusar tanto en rutas individuales como en lotes.
 * Devuelve { evento, error } donde error es null | 'no_encontrado' | 'sin_permiso'.
 */
async function _buscarEventoConPermiso(eventoId, adminId) {
  const evento = await Evento.findById(eventoId).catch(() => null);
  if (!evento) return { evento: null, error: 'no_encontrado' };
  if (String(evento.adminId) !== String(adminId)) return { evento: null, error: 'sin_permiso' };
  return { evento, error: null };
}

/** POST /api/eventos/:eventoId/asistentes — registro público (self-service, sin login) */
async function registrarAsistente(req, res, next) {
  try {
    const { eventoId } = req.params;
    const { nombre, email, empresa } = req.body;

    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
    }

    const evento = await Evento.findById(eventoId);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });

    const asistente = await Asistente.create({ eventoId, nombre, email, empresa });
    res.status(201).json({ asistente });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos/:eventoId/asistentes — lista completa (requiere ser el admin dueño) */
async function listarAsistentes(req, res, next) {
  try {
    const { evento, error } = await _buscarEventoConPermiso(req.params.eventoId, req.adminId);
    if (error === 'no_encontrado') return res.status(404).json({ error: 'Evento no encontrado.' });
    if (error === 'sin_permiso') return res.status(403).json({ error: 'No tienes permiso sobre este evento.' });

    const asistentes = await Asistente.find({ eventoId: evento._id }).sort({ createdAt: -1 });
    res.json({ asistentes });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos/:eventoId/stats — estadísticas agregadas para el dashboard */
async function estadisticasEvento(req, res, next) {
  try {
    const { evento, error } = await _buscarEventoConPermiso(req.params.eventoId, req.adminId);
    if (error === 'no_encontrado') return res.status(404).json({ error: 'Evento no encontrado.' });
    if (error === 'sin_permiso') return res.status(403).json({ error: 'No tienes permiso sobre este evento.' });

    const [registrados, confirmados, ultimosCheckins] = await Promise.all([
      Asistente.countDocuments({ eventoId: evento._id }),
      Asistente.countDocuments({ eventoId: evento._id, estadoCheckin: true }),
      Asistente.find({ eventoId: evento._id, estadoCheckin: true })
        .sort({ fechaCheckin: -1 })
        .limit(8)
    ]);

    const pendientes = registrados - confirmados;
    const capacidad = evento.capacidad;

    res.json({
      registrados,
      confirmados,
      pendientes,
      capacidad,
      porcentajeAforo: Math.min(100, Math.round((confirmados / capacidad) * 100)),
      tasaConfirmacion: registrados ? Math.round((confirmados / registrados) * 100) : 0,
      ultimosCheckins
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resuelve un check-in por código QR dentro de un evento.
 * Devuelve { status, asistente } — status: 'ok' | 'ya_registrado' | 'no_encontrado'
 */
async function _resolverCheckin(eventoId, qrCodeCrudo) {
  const qrCode = (qrCodeCrudo || '').trim().toUpperCase();
  const asistente = await Asistente.findOne({ eventoId, qrCode });

  if (!asistente) return { status: 'no_encontrado', asistente: null };
  if (asistente.estadoCheckin) return { status: 'ya_registrado', asistente };

  asistente.estadoCheckin = true;
  asistente.fechaCheckin = new Date();
  await asistente.save();
  return { status: 'ok', asistente };
}

/** POST /api/eventos/:eventoId/checkin — check-in en vivo desde el scanner (requiere login de staff/admin) */
async function checkin(req, res, next) {
  try {
    const { evento, error } = await _buscarEventoConPermiso(req.params.eventoId, req.adminId);
    if (error === 'no_encontrado') return res.status(404).json({ error: 'Evento no encontrado.' });
    if (error === 'sin_permiso') return res.status(403).json({ error: 'No tienes permiso sobre este evento.' });

    const { qrCode } = req.body;
    if (!qrCode) return res.status(400).json({ error: 'Falta el código QR.' });

    const resultado = await _resolverCheckin(evento._id, qrCode);
    const codigoHttp = resultado.status === 'no_encontrado' ? 404 : 200;
    res.status(codigoHttp).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/checkin/sync — sincroniza en lote check-ins hechos offline.
 * Body: { checkins: [{ eventoId, qrCode, timestampLocal }] }
 * Devuelve el resultado de cada uno para que el cliente sepa qué borrar de IndexedDB.
 */
async function sincronizarCheckins(req, res, next) {
  try {
    const { checkins } = req.body;
    if (!Array.isArray(checkins) || checkins.length === 0) {
      return res.status(400).json({ error: 'No se recibieron check-ins para sincronizar.' });
    }

    const resultados = [];
    for (const item of checkins) {
      try {
        const { error } = await _buscarEventoConPermiso(item.eventoId, req.adminId);
        if (error) {
          resultados.push({ idLocal: item.idLocal, status: error, qrCode: item.qrCode });
          continue;
        }
        const resultado = await _resolverCheckin(item.eventoId, item.qrCode);
        resultados.push({ idLocal: item.idLocal, qrCode: item.qrCode, ...resultado });
      } catch (errorItem) {
        resultados.push({ idLocal: item.idLocal, status: 'error', qrCode: item.qrCode, mensaje: errorItem.message });
      }
    }

    res.json({ resultados });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  registrarAsistente,
  listarAsistentes,
  estadisticasEvento,
  checkin,
  sincronizarCheckins
};
