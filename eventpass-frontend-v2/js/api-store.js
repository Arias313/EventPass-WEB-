(function() {
  const C = window.EP_CONFIG || {};
  const STORAGE_KEY = C.STORAGE_KEY || "eventpass_db_v1";
  const API_BASE = String(C.API_BASE || "http://localhost:4000/api").replace(/\/$/, "");
  const CHANNEL_NAME = C.CHANNEL || "eventpass_live";

  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_NAME) : null;
  const subs = new Set();
  const fire = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  try {
    localStorage.removeItem("ep_cuenta_creada");
  } catch (e) {
    console.warn("[EPStore] No se pudo borrar el registro local heredado:", e);
  }

  const getToken = () => localStorage.getItem("ep_token") || sessionStorage.getItem("ep_token") || "";

  const readLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { eventos: [], asistentes: [] };
    } catch (e) {
      return { eventos: [], asistentes: [] };
    }
  };

  const writeLocal = (db) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        eventos: db.eventos || [],
        asistentes: []
      }));
    } catch (e) {
      console.warn("[EPStore] Error al guardar en localStorage:", e);
    }
    if (bc) {
      try {
        bc.postMessage("change");
      } catch (e) {
        console.warn("[EPStore] Error al sincronizar pestañas:", e);
      }
    }
    fire();
  };

  // Helper HTTP para la API
  const request = async (endpoint, options = {}) => {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const isAuthRequest = endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/registro");
    const token = isAuthRequest ? "" : getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let res, data;
    try {
      res = await fetch(url, { ...options, headers, signal: controller.signal });
      try {
        data = await res.json();
      } catch (cause) {
        if (controller.signal.aborted) throw cause;
        data = {};
      }
    } catch (cause) {
      const timedOut = controller.signal.aborted || (cause && cause.name === "AbortError");
      const err = new Error(timedOut
        ? "La solicitud tardó demasiado. Comprueba tu conexión e inténtalo de nuevo."
        : "No se pudo conectar con el servidor. Comprueba tu conexión.");
      err.isNetwork = true;
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}: Fallo en la comunicación con el servidor.`);
      err.status = res.status;
      if (res.status === 401 && token) {
        window.EPStore.logout();
        const loginPath = location.pathname.includes("/pages/") ? "login.html" : "pages/login.html";
        location.replace(loginPath);
      }
      throw err;
    }
    return data;
  };

  // Normalizador de eventos (compatibilidad entre MongoDB y Vista)
  const normalizarEvento = (e) => {
    if (!e) return null;
    const id = String(e._id || e.id || "");
    const rawAforo = e.aforoTotal ?? e.capacidad ?? e.aforo;
    const aforo = rawAforo == null || rawAforo === "" ? null : Number(rawAforo);
    const fecha = e.fecha ? new Date(e.fecha) : null;
    const fechaValida = fecha && Number.isFinite(fecha.getTime()) ? fecha.toISOString() : null;
    return {
      _id: id,
      id: id,
      nombre: e.titulo || e.nombre || "Evento sin título",
      titulo: e.titulo || e.nombre || "Evento sin título",
      fecha: fechaValida,
      lugar: e.lugar || e.ubicacion || null,
      ubicacion: e.lugar || e.ubicacion || null,
      aforo: Number.isFinite(aforo) ? aforo : null,
      aforoTotal: Number.isFinite(aforo) ? aforo : null,
      registrados: Number.isFinite(Number(e.registrados)) ? Number(e.registrados) : 0,
      confirmados: Number.isFinite(Number(e.confirmados)) ? Number(e.confirmados) : 0,
      creador: e.creador || e.adminId || null
    };
  };

  // Normalizador de asistentes
  const normalizarAsistente = (a) => {
    if (!a) return null;
    const id = String(a._id || a.id || "");
    const eventoId = String((a.evento && a.evento._id) || (a.evento && a.evento.id) || a.eventoId || a.evento || "");
    const fechaRegistro = a.fechaRegistro || a.createdAt || a.ts || null;
    const parsedDate = fechaRegistro ? new Date(fechaRegistro).getTime() : 0;
    return {
      _id: id,
      id: id,
      eventoId: eventoId,
      evento: a.evento || eventoId,
      nombre: a.nombre || "",
      cedula: a.cedula || "",
      correo: a.correo || a.email || "",
      pin: typeof a.pin === "string" ? a.pin : "",
      fechaRegistro,
      ts: Number.isFinite(parsedDate) ? parsedDate : 0,
      estadoCheckin: Boolean(a.estadoCheckin ?? a.checkin),
      checkin: Boolean(a.estadoCheckin ?? a.checkin)
    };
  };

  // Estado en memoria
  let state = readLocal();
  state.eventos = (state.eventos || []).map(normalizarEvento).filter(Boolean);
  state.asistentes = [];

  const syncLocalState = () => {
    const db = readLocal();
    state.eventos = (db.eventos || []).map(normalizarEvento).filter(Boolean);
    state.asistentes = [];
    fire();
  };
  if (bc) bc.onmessage = syncLocalState;
  window.addEventListener("storage", e => {
    if (e.key === STORAGE_KEY) syncLocalState();
  });
  writeLocal(state);

  // Inicialización y refresco con el backend si hay token
  const refreshFromBackend = async () => {
    if (!getToken()) return;
    try {
      const data = await request("/eventos");
      if (Array.isArray(data.eventos)) {
        state.eventos = data.eventos.map(normalizarEvento).filter(Boolean);
        writeLocal(state);
      }
    } catch (err) {
      console.warn("[EPStore] Modo offline o servidor no disponible:", err.message);
      if (!err.isNetwork) throw err;
    }
  };

  // Intentar refresco al cargar si el token existe
  if (getToken()) {
    setTimeout(() => refreshFromBackend().catch(err => {
      console.warn("[EPStore] No se pudieron actualizar los eventos:", err.message);
    }), 50);
  }

  const guardarSesion = (data, recordar = false) => {
    if (typeof data.token !== "string" || !data.token.trim()) {
      throw new Error("El servidor no devolvió un token de sesión.");
    }
    localStorage.removeItem("ep_token");
    localStorage.removeItem("ep_admin");
    sessionStorage.removeItem("ep_token");
    sessionStorage.removeItem("ep_admin");
    const storage = recordar ? localStorage : sessionStorage;
    storage.setItem("ep_token", data.token);
    storage.setItem("ep_admin", "1");
  };

  window.EPStore = {
    // ─── Autenticación ──────────────────────────────────────────
    login: async (email, password, recordar = false) => {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      guardarSesion(data, recordar);
      await refreshFromBackend().catch(err => {
        console.warn("[EPStore] No se pudieron cargar los eventos tras iniciar sesión:", err.message);
      });
      return data;
    },

    registrarAdmin: async ({ nombre, empresa, email, password, codigoInvitacion }) => {
      const data = await request("/auth/registro", {
        method: "POST",
        body: JSON.stringify({ nombre, empresa, email, password, codigoInvitacion })
      });
      guardarSesion(data);
      return data;
    },

    logout: () => {
      sessionStorage.removeItem("ep_token");
      sessionStorage.removeItem("ep_admin");
      localStorage.removeItem("ep_token");
      localStorage.removeItem("ep_admin");
      localStorage.removeItem("ep_cuenta_creada");
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
        const data = await request(`/eventos/${encodeURIComponent(id)}`);
        if (data.evento) {
          const norm = normalizarEvento(data.evento);
          const idx = state.eventos.findIndex(e => e.id === norm.id);
          if (idx >= 0) state.eventos[idx] = norm;
          else state.eventos.unshift(norm);
          writeLocal(state);
          return norm;
        }
        return null;
      } catch (err) {
        if (err.status === 404) return null;
        if (!err.isNetwork) throw err;
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

      const data = await request("/eventos", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const ev = normalizarEvento(data.evento);
      if (!ev) throw new Error("El servidor no devolvió el evento creado.");
      state.eventos.unshift(ev);
      writeLocal(state);
      return ev;
    },

    eliminarEvento: async (id) => {
      await request(`/eventos/${encodeURIComponent(id)}`, { method: "DELETE" });
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
        const data = await request(`/eventos/${encodeURIComponent(eventoId)}/asistentes`);
        if (Array.isArray(data.asistentes)) {
          const nuevos = data.asistentes.map(normalizarAsistente).filter(Boolean);
          // Reemplazar asistentes de este evento en el estado
          state.asistentes = state.asistentes
            .filter(a => a.eventoId !== eventoId)
            .concat(nuevos);
          writeLocal(state);
          return nuevos;
        }
      } catch (err) {
        if (!err.isNetwork) throw err;
        console.warn("[EPStore] No se pudieron actualizar los asistentes:", err.message);
      }
      return window.EPStore.getAsistentes(eventoId);
    },

    getAsistente: (id) => {
      if (!id) return null;
      const key = String(id);
      return state.asistentes.find(a => a.id === key || a._id === key || a.pin === key.toUpperCase()) || null;
    },

    fetchAsistente: async (id) => {
      if (!id) return null;
      try {
        const data = await request(`/asistentes/${encodeURIComponent(id)}`);
        if (data.asistente) {
          const norm = normalizarAsistente(data.asistente);
          if (!norm) return null;
          if (norm.evento && typeof norm.evento === "object") {
            const evNorm = normalizarEvento(norm.evento);
            const idx = state.eventos.findIndex(e => e.id === evNorm.id);
            if (idx >= 0) state.eventos[idx] = evNorm;
            else state.eventos.push(evNorm);
          }
          writeLocal(state);
          return norm;
        }
        return null;
      } catch (err) {
        if (err.status === 404) return null;
        if (!err.isNetwork) throw err;
        console.warn("[EPStore] No se pudo consultar el pase en el servidor:", err.message);
      }
      return window.EPStore.getAsistente(id);
    },

    registrar: async (eventoId, { nombre, cedula, correo, empresa }) => {
      const data = await request("/asistentes", {
        method: "POST",
        body: JSON.stringify({ eventoId, nombre, cedula, correo, empresa })
      });
      const a = normalizarAsistente(data.asistente);
      if (!a || !a.id) throw new Error("El servidor no devolvió los datos del pase.");
      const ev = state.eventos.find(e => e.id === eventoId || e._id === eventoId);
      if (ev) ev.registrados += 1;
      writeLocal(state);
      return a;
    },

    // ─── Estadísticas y Check-in ────────────────────────────────
    stats: (eventoId) => {
      if (eventoId) {
        const ev = window.EPStore.getEvento(eventoId);
        const aforo = ev ? ev.aforo || 0 : 0;
        const registrados = ev ? ev.registrados : 0;
        const confirmados = ev ? ev.confirmados : 0;
        return {
          registrados,
          confirmados,
          aforo,
          ocupacion: aforo ? Math.min(100, Math.round((registrados / aforo) * 100)) : 0
        };
      }
      const aforo = state.eventos.reduce((sum, e) => sum + (e.aforo || 0), 0);
      const reg = state.eventos.reduce((sum, e) => sum + e.registrados, 0);
      return {
        eventos: state.eventos.length,
        registrados: reg,
        confirmados: state.eventos.reduce((sum, e) => sum + e.confirmados, 0),
        aforo,
        ocupacion: aforo ? Math.min(100, Math.round((reg / aforo) * 100)) : 0
      };
    },

    ocupacion: (id) => {
      const ev = window.EPStore.getEvento(id);
      const n = ev ? ev.registrados : 0;
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

    // El pase QR usa exclusivamente el PIN generado y validado por el backend.
    qrPayload: (a) => (a && a.pin) || ""
  };
})();
