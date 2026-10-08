// ============================================================
// controllers/asistenteController.js — Registro, check-in y stats
// ============================================================

const Asistente = require('../models/Asistente');
const Evento = require('../models/Evento');
const mongoose = require('mongoose');
const crypto = require('crypto');

const PIN_REGEX = /^EP-[A-F0-9]{16}$/;
const MAX_CHECKINS_POR_LOTE = 200;

/** Quita espacios, puntos y guiones: "1.234.567" y "1234567" son la misma cédula. */
function _normalizarCedula(valor) {
  return String(valor || '').replace(/[\s.\-]/g, '').toUpperCase();
}

/** Acepta "EP-XXXX…" o un QR compuesto "EP|…|PIN" y devuelve solo el PIN en mayúsculas. */
function _extraerPin(crudo) {
  const texto = String(crudo || '').trim();
  const candidato = texto.includes('|') ? texto.split('|').pop() : texto;
  return candidato.trim().toUpperCase();
}

/**
 * Helper puro: confirma que el evento existe y pertenece al admin autenticado.
 * Devuelve { evento, error } donde error es null | 'no_encontrado' | 'sin_permiso'.
 * Un id mal formado es "no_encontrado"; los fallos reales de MongoDB se propagan.
 */
async function _buscarEventoConPermiso(eventoId, adminId) {
  if (!mongoose.isValidObjectId(String(eventoId || ''))) {
    return { evento: null, error: 'no_encontrado' };
  }
  const evento = await Evento.findById(eventoId);
  if (!evento) return { evento: null, error: 'no_encontrado' };
  if (String(evento.creador) !== String(adminId)) return { evento: null, error: 'sin_permiso' };
  return { evento, error: null };
}

/** POST /api/asistentes and legacy POST /api/eventos/:eventoId/asistentes */
async function registrarAsistente(req, res, next) {
  let aforoReservado = false;
  let eventoId;
  try {
    eventoId = String(req.body.evento || req.body.eventoId || req.params.eventoId || '');
    const { nombre, empresa } = req.body;
    const correo = req.body.correo || req.body.email;

    if (![nombre, req.body.cedula, correo].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'Nombre, cédula y correo son obligatorios.' });
    }

    const cedula = _normalizarCedula(req.body.cedula);
    if (!/^[A-Z0-9]{5,15}$/.test(cedula)) {
      return res.status(400).json({ error: 'La cédula debe tener entre 5 y 15 caracteres.' });
    }
    if (!mongoose.isValidObjectId(eventoId)) {
      return res.status(400).json({ error: 'Identificador de evento inválido.' });
    }

    const eventoExiste = await Evento.exists({ _id: eventoId });
    if (!eventoExiste) return res.status(404).json({ error: 'Evento no encontrado.' });

    // Comprobación previa: evita consumir (y liberar) un cupo si la cédula ya existe.
    // La defensa real contra carreras es el índice único { evento, cedula }.
    const yaRegistrada = await Asistente.exists({ evento: eventoId, cedula });
    if (yaRegistrada) {
      return res.status(409).json({ error: 'Esta cédula ya está registrada en este evento.' });
    }

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
          cedula,
          correo: correo.trim(),
          evento: eventoId,
          empresa: typeof empresa === 'string' ? empresa.trim().slice(0, 120) : '',
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

    // Duplicado de cédula detectado por el índice único (carrera entre dos solicitudes)
    if (error.code === 11000 && (error.keyPattern?.cedula || /cedula/.test(error.message || ''))) {
      return res.status(409).json({ error: 'Esta cédula ya está registrada en este evento.' });
    }
    next(error);
  }
}

/** GET /api/asistentes/:id — consulta pública del pase. SOLO por PIN, con cédula enmascarada. */
async function obtenerAsistentePublico(req, res, next) {
  try {
    const pin = String(req.params.id || '').trim().toUpperCase();
    if (!PIN_REGEX.test(pin)) {
      return res.status(404).json({ error: 'Pase no encontrado.' });
    }

    const asistente = await Asistente.findOne({ pin }).populate('evento', 'titulo fecha lugar');
    if (!asistente) return res.status(404).json({ error: 'Pase no encontrado.' });

    res.json({
      asistente: {
        id: asistente.id,
        nombre: asistente.nombre,
        cedula: '••••' + String(asistente.cedula).slice(-4),
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
      porcentajeAforo: capacidad ? Math.min(100, Math.round((confirmados / capacidad) * 100)) : 0,
      tasaConfirmacion: registrados ? Math.round((confirmados / registrados) * 100) : 0,
      ultimosCheckins
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resuelve un check-in por PIN dentro de un evento.
 * Solo se acepta el PIN (directo o al final de un QR compuesto): nunca cédula ni _id.
 * Devuelve { status, asistente } — status: 'ok' | 'ya_registrado' | 'no_encontrado'
 */
async function _resolverCheckin(eventoId, pinCrudo) {
  const pin = _extraerPin(pinCrudo);
  if (!PIN_REGEX.test(pin)) return { status: 'no_encontrado', asistente: null };

  const filtro = { evento: eventoId, pin };

  const asistente = await Asistente.findOneAndUpdate(
    { ...filtro, estadoCheckin: { $ne: true } },
    { $set: { estadoCheckin: true, fechaCheckin: new Date() } },
    { new: true }
  );
  if (asistente) return { status: 'ok', asistente };

  const yaRegistrado = await Asistente.findOne(filtro);
  if (!yaRegistrado) return { status: 'no_encontrado', asistente: null };
  return { status: 'ya_registrado', asistente: yaRegistrado };
}

/** POST /api/eventos/:eventoId/checkin — check-in en vivo desde el scanner (requiere login de staff/admin) */
async function checkin(req, res, next) {
  try {
    const { evento, error } = await _buscarEventoConPermiso(req.params.eventoId, req.adminId);
    if (error === 'no_encontrado') return res.status(404).json({ error: 'Evento no encontrado.' });
    if (error === 'sin_permiso') return res.status(403).json({ error: 'No tienes permiso sobre este evento.' });

    const qrCode = req.body.qrCode || req.body.pin;
    if (typeof qrCode !== 'string' || !qrCode.trim()) {
      return res.status(400).json({ error: 'Falta el código QR.' });
    }

    const resultado = await _resolverCheckin(evento._id, qrCode);
    const codigoHttp = resultado.status === 'no_encontrado' ? 404 : 200;
    res.status(codigoHttp).json(resultado);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/checkin/sync — sincroniza en lote check-ins hechos offline.
 * Body: { checkins: [{ idLocal, eventoId, qrCode, timestampLocal }] }
 * Devuelve el resultado de cada uno para que el cliente sepa qué borrar de IndexedDB.
 */
async function sincronizarCheckins(req, res, next) {
  try {
    const { checkins } = req.body;
    if (!Array.isArray(checkins) || checkins.length === 0) {
      return res.status(400).json({ error: 'No se recibieron check-ins para sincronizar.' });
    }
    if (checkins.length > MAX_CHECKINS_POR_LOTE) {
      return res.status(413).json({ error: `Máximo ${MAX_CHECKINS_POR_LOTE} check-ins por lote.` });
    }

    const resultados = [];
    for (const item of checkins) {
      const idLocal = item && item.idLocal;
      const qrCode = item && item.qrCode;
      try {
        if (!item || typeof item !== 'object') {
          resultados.push({ idLocal, status: 'invalido', qrCode });
          continue;
        }
        const { error } = await _buscarEventoConPermiso(item.eventoId, req.adminId);
        if (error) {
          resultados.push({ idLocal, status: error, qrCode });
          continue;
        }
        const resultado = await _resolverCheckin(item.eventoId, qrCode);
        resultados.push({ idLocal, qrCode, ...resultado });
      } catch (errorItem) {
        console.error('[sync] Error procesando check-in:', errorItem);
        resultados.push({ idLocal, status: 'error', qrCode });
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