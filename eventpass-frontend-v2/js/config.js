// ============================================================
// config.js — Configuración compartida y dinámica del frontend
// ============================================================
//
// Seguridad: la URL de la API NO se puede cambiar desde la URL de la página
// (?api=) ni desde localStorage. Antes, un enlace malicioso podía redirigir
// el login y el registro a un servidor ajeno y dejarlo guardado para siempre.
// Solo el autor del sitio puede definirla, mediante el meta tag o la variable
// global; si no hay ninguno, se usa la detección estática por entorno.

(function () {
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const limpiar = (valor) => valor.trim().replace(/\/+$/, "");

  // Limpieza: borra overrides que un enlace ?api= pudo dejar guardados en versiones anteriores.
  try {
    localStorage.removeItem("EVENTPASS_API_BASE");
    localStorage.removeItem("ep_api_base");
  } catch (_) {}

  // 1. Variable global window.EVENTPASS_API_BASE (definida por el autor del sitio antes de este script)
  const globalApi = typeof window.EVENTPASS_API_BASE === "string" && window.EVENTPASS_API_BASE.trim()
    ? limpiar(window.EVENTPASS_API_BASE)
    : null;

  // 2. Meta tag en el <head>: <meta name="eventpass-api-base" content="https://tu-backend.com/api">
  const metaTag = document.querySelector('meta[name="eventpass-api-base"]');
  const metaContent = metaTag && metaTag.getAttribute("content");
  const metaApi = metaContent && metaContent.trim() ? limpiar(metaContent) : null;

  // 3. Detección estática según el entorno:
  // - En desarrollo local -> http://localhost:4000/api
  // - En producción/nube  -> mismo origen (el backend sirve los estáticos o hay reverse proxy)
  const fallbackApi = isLocal
    ? "http://localhost:4000/api"
    : `${window.location.origin}/api`;

  const resolvedApiBase = globalApi || metaApi || fallbackApi;

  window.EP_CONFIG = {
    STORAGE_KEY: "eventpass_db_v1",
    CHANNEL: "eventpass_live",
    API_BASE: resolvedApiBase,
    IS_LOCAL: isLocal,
    GOOGLE_CLIENT_ID: "172034190755-khuslhn47kk57odvkpo065euadl0suoh.apps.googleusercontent.com"
  };

  // Si estamos en la nube pero la API apunta a localhost, mostrar aviso proactivo
  if (!isLocal && resolvedApiBase.includes("localhost")) {
    console.warn(
      `[EP_CONFIG] ⚠ ADVERTENCIA DE CONFIGURACIÓN:\n` +
      `El frontend se está ejecutando en "${window.location.origin}", pero API_BASE apunta a "${resolvedApiBase}".\n` +
      `Para conectar con tu backend en producción, agrega en el <head> de los HTML:\n` +
      `<meta name="eventpass-api-base" content="https://tu-api.onrender.com/api">`
    );
  }
})();
