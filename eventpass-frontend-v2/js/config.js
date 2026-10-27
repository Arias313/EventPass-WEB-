// ============================================================
// config.js — Configuración compartida y dinámica del frontend
// ============================================================

(function () {
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  // 1. Detección por parámetro de URL (?api=https://...) útil para staging o demos inmediatas
  let queryApi = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const paramVal = params.get("api");
    if (paramVal && paramVal.trim()) {
      queryApi = paramVal.trim().replace(/\/+$/, "");
      try {
        localStorage.setItem("EVENTPASS_API_BASE", queryApi);
      } catch (_) {}
    }
  } catch (_) {}

  // 2. Variable global window.EVENTPASS_API_BASE (inyección externa previa)
  const globalApi = typeof window.EVENTPASS_API_BASE === "string" && window.EVENTPASS_API_BASE.trim()
    ? window.EVENTPASS_API_BASE.trim().replace(/\/+$/, "")
    : null;

  // 3. Meta tag en el <head>: <meta name="eventpass-api-base" content="https://tu-backend.com/api">
  const metaTag = document.querySelector('meta[name="eventpass-api-base"]');
  const metaApi = metaTag && metaTag.getAttribute("content") && metaTag.getAttribute("content").trim()
    ? metaTag.getAttribute("content").trim().replace(/\/+$/, "")
    : null;

  // 4. Almacenamiento local persistente (manual override o sesión previa)
  let storageApi = null;
  try {
    const st = localStorage.getItem("EVENTPASS_API_BASE") || localStorage.getItem("ep_api_base");
    if (st && st.trim()) {
      storageApi = st.trim().replace(/\/+$/, "");
    }
  } catch (_) {}

  // 5. Fallback inteligente según entorno:
  // - En desarrollo local -> http://localhost:4000/api
  // - En producción/nube -> ruta relativa al origen actual (funciona de inmediato si el backend sirve los estáticos o hay reverse proxy)
  const fallbackApi = isLocal
    ? "http://localhost:4000/api"
    : `${window.location.origin}/api`;

  // Jerarquía de resolución
  const resolvedApiBase = queryApi || globalApi || metaApi || storageApi || fallbackApi;

  window.EP_CONFIG = {
    STORAGE_KEY: "eventpass_db_v1",
    CHANNEL: "eventpass_live",
    API_BASE: resolvedApiBase,
    IS_LOCAL: isLocal,
    GOOGLE_CLIENT_ID: "172034190755-khuslhn47kk57odvkpo065euadl0suoh.apps.googleusercontent.com",

    /**
     * Permite reconfigurar la URL de la API dinámicamente desde consola o UI
     * @param {string} newUrl - Nueva URL base (ej. 'https://api-eventpass.onrender.com/api')
     */
    setApiBase: function (newUrl) {
      if (!newUrl || typeof newUrl !== "string") return;
      const cleanUrl = newUrl.trim().replace(/\/+$/, "");
      this.API_BASE = cleanUrl;
      try {
        localStorage.setItem("EVENTPASS_API_BASE", cleanUrl);
      } catch (_) {}
      console.log("[EP_CONFIG] API_BASE configurada dinámicamente a:", cleanUrl);
    }
  };

  // Si estamos en la nube pero la API apunta a localhost, mostrar aviso proactivo
  if (!isLocal && resolvedApiBase.includes("localhost")) {
    console.warn(
      `[EP_CONFIG] ⚠ ADVERTENCIA DE CONFIGURACIÓN:\n` +
      `El frontend se está ejecutando en "${window.location.origin}", pero API_BASE apunta a "${resolvedApiBase}".\n` +
      `Para conectar con tu backend en producción:\n` +
      `1. Agrega <meta name="eventpass-api-base" content="https://tu-api.onrender.com/api"> en el <head> de los HTML, o\n` +
      `2. Ejecuta en consola: EP_CONFIG.setApiBase("https://tu-api.onrender.com/api")`
    );
  }
})();
