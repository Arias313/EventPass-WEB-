// ============================================================
// controllers/asistenteController.js — Registro, check-in y stats
// ============================================================

const Asistente = require('../models/Asistente');
const Evento = require('../models/Evento');
const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Helper puro: confirma que el evento existe y pertenece al admin autenticado.
 * No depende de `res`, así se puede reusar tanto en rutas individuales como en lotes.
 * Devuelve { evento, error } donde error es null | 'no_encontrado' | 'sin_permiso'.
 */
async function _buscarEventoConPermiso(eventoId, adminId) {
  const evento = await Evento.findById(eventoId).catch(() => null);
  if (!evento) return { evento: null, error: 'no_encontrado' };
  if (String(evento.creador) !== String(adminId)) return { evento: null, error: 'sin_permiso' };
  return { evento, error: null };
}

/** POST /api/asistentes and legacy POST /api/eventos/:eventoId/asistentes */
async function registrarAsistente(req, res, next) {
  let aforoReservado = false;
  let eventoId;
  try {
<<<<<<< HEAD
    eventoId = req.body.evento || req.body.eventoId || req.params.eventoId;
=======
    eventoId = req.body.evento || req.params.eventoId;
>>>>>>> a56a81421fdf70fcc25b35e662a63f3f9783c622
    const { nombre, cedula, empresa } = req.body;
    const correo = req.body.correo || req.body.email;

    if (![nombre, cedula, correo].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'Nombre, cédula y correo son obligatorios.' });
    }
    if (!mongoose.isValidObjectId(eventoId)) {
      return res.status(400).json({ error: 'Identificador de evento inválido.' });
    }

    const eventoExiste = await Evento.exists({ _id: eventoId });
    if (!eventoExiste) return res.status(404).json({ error: 'Evento no encontrado.' });

    const eventoReservado = await Evento.findOneAndUpdate(
      {
        _id: eventoId,
        $expr: { $lt: [{ $ifNull: ['$registrados', 0] }, '$aforoTotal'] }
      },
      { $inc: { registrados: 1 } },
      { new: true }
    );
    if (!eventoReservado) {
      return res.status(409).json({ error: 'El evento alcanzó su aforo máximo.' });
    }
    aforoReservado = true;

    let asistente;
    for (let intento = 0; intento < 3; intento += 1) {
      try {
        asistente = await Asistente.create({
          nombre: nombre.trim(),
          cedula: cedula.trim(),
          correo: correo.trim(),
          evento: eventoId,
          empresa,
          pin: `EP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`
        });
        break;
      } catch (error) {
        const duplicadoPin = error.code === 11000 && error.keyPattern?.pin;
        if (!duplicadoPin || intento === 2) throw error;
      }
    }

    res.status(201).json({ asistente });
  } catch (error) {
    if (aforoReservado) {
      await Evento.updateOne({ _id: eventoId }, { $inc: { registrados: -1 } }).catch(() => {});
    }
    next(error);
  }
}

/** GET /api/asistentes/:id — consulta pública del pase por ObjectId o PIN */
async function obtenerAsistentePublico(req, res, next) {
  try {
    const identificador = String(req.params.id || '').trim();
    const consulta = mongoose.isValidObjectId(identificador)
      ? Asistente.findById(identificador)
      : Asistente.findOne({ pin: identificador.toUpperCase() });
    const asistente = await consulta.populate('evento', 'titulo fecha lugar aforoTotal');

    if (!asistente) return res.status(404).json({ error: 'Pase no encontrado.' });

    res.json({
      asistente: {
        id: asistente.id,
        nombre: asistente.nombre,
        cedula: asistente.cedula,
        correo: asistente.correo,
        pin: asistente.pin,
        fechaRegistro: asistente.fechaRegistro,
        evento: asistente.evento
      }
    });
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

    const asistentes = await Asistente.find({ evento: evento._id }).sort({ fechaRegistro: -1 });
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
      Asistente.countDocuments({ evento: evento._id }),
      Asistente.countDocuments({ evento: evento._id, estadoCheckin: true }),
      Asistente.find({ evento: evento._id, estadoCheckin: true })
        .sort({ fechaCheckin: -1 })
        .limit(8)
    ]);

    const pendientes = registrados - confirmados;
    const capacidad = evento.aforoTotal;

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
async function _resolverCheckin(eventoId, pinCrudo) {
<<<<<<< HEAD
  const crudo = String(pinCrudo || '').trim();
  let pin = crudo.toUpperCase();

  // Si el scanner envía el QR en formato compuesto (ej. EP|eventoId|asistenteId|cedula o EP|eventoId|pin)
  let asistenteId = null;
  let cedula = null;
  if (crudo.includes('|')) {
    const partes = crudo.split('|');
    // Si tiene 4 partes: EP | eventoId | id | cedula
    if (partes.length >= 4) {
      asistenteId = partes[2].trim();
      cedula = partes[3].trim();
    } else if (partes.length >= 2) {
      pin = partes[partes.length - 1].trim().toUpperCase();
    }
  }

  const condiciones = [{ pin }];
  if (asistenteId && mongoose.isValidObjectId(asistenteId)) {
    condiciones.push({ _id: asistenteId });
  }
  if (mongoose.isValidObjectId(crudo)) {
    condiciones.push({ _id: crudo });
  }
  if (cedula) {
    condiciones.push({ cedula });
  }

  const asistente = await Asistente.findOne({
    evento: eventoId,
    $or: condiciones
  });
=======
  const pin = (pinCrudo || '').trim().toUpperCase();
  const asistente = await Asistente.findOne({ evento: eventoId, pin });
>>>>>>> a56a81421fdf70fcc25b35e662a63f3f9783c622

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

    const qrCode = req.body.qrCode || req.body.pin;
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
  obtenerAsistentePublico,
  listarAsistentes,
  estadisticasEvento,
  checkin,
  sincronizarCheckins
};
