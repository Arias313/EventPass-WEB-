// ============================================================
// auth.js — Lógica de la página de acceso (login / registro admin)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión activa, no tiene sentido mostrar el login de nuevo
  if (EventPassAPI.auth.estaAutenticado()) {
    window.location.href = 'eventos.html';
    return;
  }

  const tabLogin = document.getElementById('tab-login');
  const tabRegistro = document.getElementById('tab-registro');
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro-admin');
  const elError = document.getElementById('auth-error');

  function mostrarTab(tab) {
    const esLogin = tab === 'login';
    tabLogin.classList.toggle('is-active', esLogin);
    tabRegistro.classList.toggle('is-active', !esLogin);
    formLogin.classList.toggle('is-active', esLogin);
    formRegistro.classList.toggle('is-active', !esLogin);
    ocultarError();
  }

  function mostrarError(mensaje) {
    elError.textContent = mensaje;
    elError.style.display = 'block';
  }

  function ocultarError() {
    elError.style.display = 'none';
  }

  tabLogin.addEventListener('click', () => mostrarTab('login'));
  tabRegistro.addEventListener('click', () => mostrarTab('registro'));

  formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarError();

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      await EventPassAPI.auth.login(email, password);
      window.location.href = 'eventos.html';
    } catch (error) {
      mostrarError(error.message);
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  formRegistro.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarError();

    const btn = document.getElementById('btn-registro-admin');
    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';

    try {
      const nombre = document.getElementById('reg-nombre').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      await EventPassAPI.auth.registrar(nombre, email, password);
      window.location.href = 'eventos.html';
    } catch (error) {
      mostrarError(error.message);
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
    }
  });
});
