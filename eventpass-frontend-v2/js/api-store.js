/* ============================================================
 * api-store.js — Capa de datos de EventPass (API REST + Cache Local)
 * Conecta con el backend Express y mantiene sincronización reactiva
 * ============================================================ */
(function() {
  const C = window.EP_CONFIG || {};
  const STORAGE_KEY = C.STORAGE_KEY || "eventpass_db_v1";
  const API_BASE = (C.API_BASE || "http://localhost:4000/api").replace(/\/$/, "");
  const CHANNEL_NAME = C.CHANNEL || "eventpass_live";

  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_NAME) : null;
  const subs = new Set();
  const fire = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  if (bc) bc.onmessage = fire;
  window.addEventListener("storage", e => { if (e.key === STORAGE_KEY) fire(); });

  const getToken = () => sessionStorage.getItem("ep_token") || "";

  const readLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { eventos: [], asistentes: [] };
    } catch (e) {
      return { eventos: [], asistentes: [] };
    }
  };

  const writeLocal = (db) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      if (bc) bc.postMessage("change");
      fire();
    } catch (e) {
      console.warn("[EPStore] Error al guardar en localStorage:", e);
    }
  };

  // Helper HTTP para la API
  const request = async (endpoint, options = {}) => {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Error ${res.status}: Fallo en la comunicación con el servidor.`);
    }
    return data;
  };

  // Normalizador de eventos (compatibilidad entre MongoDB y Vista)
  const normalizarEvento = (e) => {
    if (!e) return null;
    const id = String(e._id || e.id || "");
    return {
      _id: id,
      id: id,
      nombre: e.titulo || e.nombre || "Evento sin título",
      titulo: e.titulo || e.nombre || "Evento sin título",
      fecha: e.fecha || new Date().toISOString(),
      lugar: e.lugar || e.ubicacion || "Sin ubicación",
      ubicacion: e.lugar || e.ubicacion || "Sin ubicación",
      aforo: Number(e.aforoTotal ?? e.capacidad ?? e.aforo ?? 100),
      aforoTotal: Number(e.aforoTotal ?? e.capacidad ?? e.aforo ?? 100),
      registrados: Number(e.registrados || 0),
      confirmados: Number(e.confirmados || 0),
      creador: e.creador || e.adminId || null
    };
  };

  // Normalizador de asistentes
  const normalizarAsistente = (a) => {
    if (!a) return null;
    const id = String(a._id || a.id || "");
    const eventoId = String((a.evento && a.evento._id) || (a.evento && a.evento.id) || a.eventoId || a.evento || "");
    return {
      _id: id,
      id: id,
      eventoId: eventoId,
      evento: a.evento || eventoId,
      nombre: a.nombre || "",
      cedula: a.cedula || "",
      correo: a.correo || a.email || "",
      pin: a.pin || (id ? `EP-${id.slice(-8).toUpperCase()}` : "EP-00000000"),
      fechaRegistro: a.fechaRegistro || a.createdAt || a.ts || new Date().toISOString(),
      ts: new Date(a.fechaRegistro || a.createdAt || a.ts || Date.now()).getTime(),
      estadoCheckin: Boolean(a.estadoCheckin ?? a.checkin),
      checkin: Boolean(a.estadoCheckin ?? a.checkin)
    };
  };

  // Estado en memoria
  let state = readLocal();
  state.eventos = (state.eventos || []).map(normalizarEvento);
  state.asistentes = (state.asistentes || []).map(normalizarAsistente);

  // Inicialización y refresco con el backend si hay token
  const refreshFromBackend = async () => {
    if (!getToken()) return;
    try {
      const data = await request("/eventos");
      if (Array.isArray(data.eventos)) {
        state.eventos = data.eventos.map(normalizarEvento);
        writeLocal(state);
      }
    } catch (err) {
      console.warn("[EPStore] Modo offline o servidor no disponible:", err.message);
    }
  };

  // Intentar refresco al cargar si el token existe
  if (getToken()) {
    setTimeout(refreshFromBackend, 50);
  }

  window.EPStore = {
    // ─── Autenticación ──────────────────────────────────────────
    login: async (email, password) => {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (data.token) {
        sessionStorage.setItem("ep_token", data.token);
      }
      sessionStorage.setItem("ep_admin", "1");
      await refreshFromBackend();
      return data;
    },

    registerAdmin: async ({ nombre, email, password }) => {
      const data = await request("/auth/registro", {
        method: "POST",
        body: JSON.stringify({ nombre, email, password })
      });
      if (data.token) {
        sessionStorage.setItem("ep_token", data.token);
      }
      sessionStorage.setItem("ep_admin", "1");
      return data;
    },

    registro: async (datos) => window.EPStore.registerAdmin(datos),

    logout: () => {
      sessionStorage.removeItem("ep_token");
      sessionStorage.removeItem("ep_admin");
      state = { eventos: [], asistentes: [] };
      writeLocal(state);
    },

    // ─── Eventos ────────────────────────────────────────────────
    listarEventos: () => state.eventos,

    refreshEventos: async () => {
      await refreshFromBackend();
      return state.eventos;
    },

    getEvento: (id) => {
      if (!id) return null;
      return state.eventos.find(e => e.id === id || e._id === id) || null;
    },

    fetchEvento: async (id) => {
      if (!id) return null;
      try {
        const data = await request(`/eventos/${id}`);
        if (data.evento) {
          const norm = normalizarEvento(data.evento);
          const idx = state.eventos.findIndex(e => e.id === norm.id);
          if (idx >= 0) state.eventos[idx] = norm;
          else state.eventos.unshift(norm);
          writeLocal(state);
          return norm;
        }
      } catch (e) {
        // Fallback al cache
      }
      return window.EPStore.getEvento(id);
    },

    crearEvento: async ({ nombre, fecha, lugar, aforo }) => {
      const payload = {
        titulo: nombre,
        fecha,
        lugar,
        aforoTotal: Math.max(1, Number(aforo) || 1)
      };

      try {
        const data = await request("/eventos", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const ev = normalizarEvento(data.evento);
        state.eventos.unshift(ev);
        writeLocal(state);
        return ev;
      } catch (err) {
        // Si no hay red, guardar localmente para sincronizar luego
        console.warn("[EPStore] Creando evento en modo local por fallo de API:", err.message);
        const ev = normalizarEvento({
          id: "ev" + Math.random().toString(36).slice(2, 9),
          nombre,
          fecha,
          lugar,
          aforo: Math.max(1, Number(aforo) || 1)
        });
        state.eventos.unshift(ev);
        writeLocal(state);
        return ev;
      }
    },

    eliminarEvento: async (id) => {
      try {
        await request(`/eventos/${id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("[EPStore] Error eliminando en backend, eliminando localmente:", e.message);
      }
      state.eventos = state.eventos.filter(e => e.id !== id && e._id !== id);
      state.asistentes = state.asistentes.filter(a => a.eventoId !== id);
      writeLocal(state);
    },

    // ─── Asistentes ─────────────────────────────────────────────
    getAsistentes: (eventoId) => {
      return state.asistentes
        .filter(a => a.eventoId === eventoId)
        .sort((a, b) => b.ts - a.ts);
    },

    fetchAsistentes: async (eventoId) => {
      if (!eventoId) return [];
      try {
        const data = await request(`/eventos/${eventoId}/asistentes`);
        if (Array.isArray(data.asistentes)) {
          const nuevos = data.asistentes.map(normalizarAsistente);
          // Reemplazar asistentes de este evento en el estado
          state.asistentes = state.asistentes
            .filter(a => a.eventoId !== eventoId)
            .concat(nuevos);
          writeLocal(state);
          return nuevos;
        }
      } catch (e) {
        console.warn("[EPStore] No se pudieron cargar los asistentes del backend:", e.message);
      }
      return window.EPStore.getAsistentes(eventoId);
    },

    getAsistente: (id) => {
      if (!id) return null;
      return state.asistentes.find(a => a.id === id || a._id === id || a.pin === id.toUpperCase()) || null;
    },

    fetchAsistente: async (id) => {
      if (!id) return null;
      try {
        const data = await request(`/asistentes/${id}`);
        if (data.asistente) {
          const norm = normalizarAsistente(data.asistente);
          if (norm.evento && typeof norm.evento === "object") {
            const evNorm = normalizarEvento(norm.evento);
            const idx = state.eventos.findIndex(e => e.id === evNorm.id);
            if (idx >= 0) state.eventos[idx] = evNorm;
            else state.eventos.push(evNorm);
          }
          const idx = state.asistentes.findIndex(a => a.id === norm.id || a.pin === norm.pin);
          if (idx >= 0) state.asistentes[idx] = norm;
          else state.asistentes.push(norm);
          writeLocal(state);
          return norm;
        }
      } catch (e) {
        console.warn("[EPStore] Error al consultar pase:", e.message);
      }
      return window.EPStore.getAsistente(id);
    },

    registrar: async (eventoId, { nombre, cedula, correo, empresa }) => {
      try {
        const data = await request("/asistentes", {
          method: "POST",
          body: JSON.stringify({
            eventoId,
            evento: eventoId,
            nombre,
            cedula,
            correo,
            empresa
          })
        });
        const a = normalizarAsistente(data.asistente);
        state.asistentes.push(a);

        // Actualizar contador del evento local si existe
        const ev = state.eventos.find(e => e.id === eventoId || e._id === eventoId);
        if (ev) ev.registrados = (ev.registrados || 0) + 1;

        writeLocal(state);
        return a;
      } catch (err) {
        // Fallback local si el servidor no responde
        if (err.message && err.message.includes("aforo")) {
          throw err;
        }
        console.warn("[EPStore] Fallo conexión backend, registrando local:", err.message);
        const a = normalizarAsistente({
          id: "as" + Math.random().toString(36).slice(2, 9),
          eventoId,
          nombre,
          cedula,
          correo,
          pin: "EP-" + Math.random().toString(36).slice(2, 10).toUpperCase()
        });
        state.asistentes.push(a);
        writeLocal(state);
        return a;
      }
    },

    // ─── Estadísticas y Check-in ────────────────────────────────
    stats: (eventoId) => {
      if (eventoId) {
        const ev = window.EPStore.getEvento(eventoId);
        const lista = window.EPStore.getAsistentes(eventoId);
        const conf = lista.filter(a => a.estadoCheckin).length;
        const aforo = ev ? ev.aforo : 0;
        return {
          registrados: lista.length,
          confirmados: conf,
          aforo,
          ocupacion: aforo ? Math.min(100, Math.round((lista.length / aforo) * 100)) : 0
        };
      }
      const aforo = state.eventos.reduce((s, e) => s + (e.aforo || 0), 0);
      const reg = state.asistentes.length;
      return {
        eventos: state.eventos.length,
        registrados: reg,
        aforo,
        ocupacion: aforo ? Math.min(100, Math.round((reg / aforo) * 100)) : 0
      };
    },

    ocupacion: (id) => {
      const ev = window.EPStore.getEvento(id);
      const asistentes = window.EPStore.getAsistentes(id);
      const n = Math.max(asistentes.length, ev ? (ev.registrados || 0) : 0);
      const aforo = ev ? ev.aforo : 0;
      return {
        n,
        aforo,
        pct: aforo ? Math.min(100, Math.round((n / aforo) * 100)) : 0
      };
    },

    exportState: () => state,
    subscribe: (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },

    // El payload del QR: usamos el PIN único (ej. EP-4F91A2B8) que valida directamente el backend
    qrPayload: (a) => (a && (a.pin || a.id || a._id)) || ""
  };
})();
