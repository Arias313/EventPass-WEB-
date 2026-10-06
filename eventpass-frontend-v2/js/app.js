// ============================================================
// app.js — Núcleo PWA, Estado de Red, Instalación y Sincronización
// ============================================================
(function(){
  // 1. Detección dinámica de conexión a Red (Online / Offline)
  const st = document.getElementById("connection-status");
  function net(){
    if(!st) return;
    const on = navigator.onLine;
    st.className = on ? "status-online" : "status-offline";
    st.textContent = on ? "● En línea" : "● Sin conexión";
  }
  addEventListener("online", net);
  addEventListener("offline", net);
  net();

  // 2. Prompt de Instalación PWA
  let dp;
  const btn = document.getElementById("btn-instalar");
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    dp = e;
    if(btn) btn.style.display = "inline-flex";
  });
  btn && btn.addEventListener("click", async () => {
    if(!dp) return;
    dp.prompt();
    await dp.userChoice;
    dp = null;
    btn.style.display = "none";
  });

  // 3. Control de Estado de Autenticación en la Landing Page
  const isAdmin = sessionStorage.getItem("ep_admin") === "1";

  // Botones para estado SIN SESIÓN
  const authLoggedOut = ["head-login", "head-register", "side-login", "side-register"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  // Botones para estado CON SESIÓN (Solo navega al Panel)
  const authLoggedIn = ["head-dashboard", "side-dashboard"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  // Alterna visibilidad mediante la clase CSS .hidden-auth
  authLoggedOut.forEach(element => element.classList.toggle("hidden-auth", isAdmin));
  authLoggedIn.forEach(element => element.classList.toggle("hidden-auth", !isAdmin));

  // Cierre de sesión (Ubicado únicamente dentro del panel/sidebar si aplica)
  const logout = () => {
    if (window.EPStore && typeof window.EPStore.logout === "function") {
      window.EPStore.logout();
    } else {
      sessionStorage.removeItem("ep_admin");
      sessionStorage.removeItem("ep_token");
    }
    window.location.reload();
  };

  const sideLogoutBtn = document.getElementById("side-logout");
  if (sideLogoutBtn) sideLogoutBtn.addEventListener("click", logout);

  // 4. Registro automático del Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const swPath = location.pathname.includes("/pages/") ? "../service-worker.js" : "./service-worker.js";
      navigator.serviceWorker.register(swPath).catch(err => {
        console.warn("[SW] Registro no disponible o bloqueado en este entorno:", err.message);
      });
    });
  }

  // 5. Utilidades globales (Incluyendo Generador de QR)
  window.EPUtil = {
    esc: s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    pin: id => {
      const code = String(id).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
      return code.length > 4 ? code.slice(0, 4) + "-" + code.slice(4) : code;
    },
    renderQr(canvas, payload) {
      if (!canvas) return false;
      const context = canvas.getContext("2d");
      if (context) context.clearRect(0, 0, canvas.width, canvas.height);

      if (typeof payload !== "string" || !payload.trim()) {
        this.toast("Datos de QR no válidos");
        return false;
      }

      // Validación de librería cargada en window
      if (!window.QRCode || typeof window.QRCode.toCanvas !== "function") {
        console.error("[QR Error] La librería QRCode no se ha cargado en el scope global.");
        this.toast("No se pudo cargar el QR; usa el PIN de entrada");
        return false;
      }

      try {
        window.QRCode.toCanvas(
          canvas,
          payload,
          {
            width: 240,
            margin: 1,
            color: { dark: "#020618", light: "#ffffff" }
          },
          err => {
            if (err) {
              console.error("[QR Canvas Error]", err);
              this.toast("No se pudo generar el QR; usa el PIN de entrada");
            }
          }
        );
        return true;
      } catch (e) {
        console.error("[QR Exception]", e);
        this.toast("No se pudo generar el QR; usa el PIN de entrada");
        return false;
      }
    },
    toast(m) {
      const t = document.createElement("div");
      t.className = "toast";
      t.textContent = m;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    },
    param: k => new URLSearchParams(location.search).get(k)
  };
})();