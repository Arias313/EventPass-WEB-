// ============================================================
// controllers/eventoController.js — CRUD de eventos
// ============================================================

const Evento = require('../models/Evento');
const Asistente = require('../models/Asistente');

/** POST /api/eventos — crea un evento (requiere auth) */
async function crearEvento(req, res, next) {
  try {
    const titulo = req.body.titulo ?? req.body.nombre;
    const fecha = req.body.fecha;
    const lugar = req.body.lugar ?? req.body.ubicacion;
    const aforoTotal = req.body.aforoTotal ?? req.body.capacidad;

    if (!titulo || !fecha || !lugar || aforoTotal === undefined) {
      return res.status(400).json({ error: 'Título, fecha, lugar y aforo total son obligatorios.' });
    }

    const evento = await Evento.create({
      creador: req.adminId,
      titulo,
      fecha,
      lugar,
      aforoTotal
    });
    res.status(201).json({ evento });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos — lista los eventos del admin autenticado */
async function listarMisEventos(req, res, next) {
  try {
    const eventos = await Evento.find({ creador: req.adminId }).sort({ fecha: 1 });

    if (!eventos.length) {
      return res.json({ eventos: [] });
    }

    const eventoIds = eventos.map(e => e._id);
    const conteos = await Asistente.aggregate([
      { $match: { evento: { $in: eventoIds } } },
      {
        $group: {
          _id: '$evento',
          registrados: { $sum: 1 },
          confirmados: { $sum: { $cond: ['$estadoCheckin', 1, 0] } }
        }
      }
    ]);

    const mapaConteos = new Map();
    conteos.forEach(c => {
      mapaConteos.set(String(c._id), {
        registrados: c.registrados || 0,
        confirmados: c.confirmados || 0
      });
    });

    const eventosConConteo = eventos.map(evento => {
      const stats = mapaConteos.get(String(evento._id)) || { registrados: 0, confirmados: 0 };
      return { ...evento.toJSON(), ...stats };
    });

    res.json({ eventos: eventosConConteo });
  } catch (error) {
    next(error);
  }
}

/** GET /api/eventos/:id — detalle público del evento */
async function obtenerEvento(req, res, next) {
  try {
    const evento = await Evento.findById(req.params.id || req.params.eventoId);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });
    const [registrados, confirmados] = await Promise.all([
      Asistente.countDocuments({ evento: evento._id }),
      Asistente.countDocuments({ evento: evento._id, estadoCheckin: true })
    ]);
    res.json({ evento: { ...evento.toJSON(), registrados, confirmados } });
  } catch (error) {
    next(error);
  }
}

/** PUT /api/eventos/:eventoId — edita un evento (solo su dueño) */
async function actualizarEvento(req, res, next) {
  try {
    const evento = await _verificarPropiedad(req, res);
    if (!evento) return;

    const titulo = req.body.titulo ?? req.body.nombre;
    const fecha = req.body.fecha;
    const lugar = req.body.lugar ?? req.body.ubicacion;
    const aforoTotal = req.body.aforoTotal ?? req.body.capacidad;
    if (titulo !== undefined) evento.titulo = titulo;
    if (fecha !== undefined) evento.fecha = fecha;
    if (lugar !== undefined) evento.lugar = lugar;
    if (aforoTotal !== undefined) evento.aforoTotal = aforoTotal;

    await evento.save();
    res.json({ evento });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/eventos/:eventoId — elimina un evento y sus asistentes (solo su dueño) */
async function eliminarEvento(req, res, next) {
  try {
    const evento = await _verificarPropiedad(req, res);
    if (!evento) return;

    await Promise.all([
      Asistente.deleteMany({ evento: evento._id }),
      evento.deleteOne()
    ]);

    res.json({ mensaje: 'Evento eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
}

/** Helper interno: valida que el evento exista y pertenezca al admin autenticado */
async function _verificarPropiedad(req, res) {
  const evento = await Evento.findById(req.params.id || req.params.eventoId);
  if (!evento) {
    res.status(404).json({ error: 'Evento no encontrado.' });
    return null;
  }
  if (String(evento.creador) !== String(req.adminId)) {
    res.status(403).json({ error: 'No tienes permiso sobre este evento.' });
    return null;
  }
  return evento;
}

module.exports = { crearEvento, listarMisEventos, obtenerEvento, actualizarEvento, eliminarEvento };
