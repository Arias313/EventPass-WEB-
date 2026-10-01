// ============================================================
// qr-scanner.js — Escáner de Cámara y Check-in Local
// ============================================================

const STORAGE_ASISTENTES = 'eventpass_asistentes_local';
const STORAGE_CHECKINS = 'eventpass_checkins_pending';

function toast(mensaje, tipo) {
  if (window.EventPassUI && typeof EventPassUI.mostrarToast === 'function') {
    EventPassUI.mostrarToast(mensaje, tipo);
    return;
  }
  alert(mensaje);
}

function mensajeErrorCamara(err) {
  const nombre = (err && (err.name || err.type)) || '';
  const texto = (err && err.message) || String(err || '');

  if (!window.isSecureContext) {
    return 'La cámara solo funciona en HTTPS o en localhost. Abre la app desde un origen seguro.';
  }
  if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
    return 'Permiso de cámara denegado. Actívalo en el navegador e inténtalo de nuevo.';
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
    return 'No se encontró una cámara disponible en este dispositivo.';
  }
  if (nombre === 'NotReadableError' || nombre === 'TrackStartError') {
    return 'La cámara está ocupada por otra aplicación.';
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'Este navegador no permite acceso a la cámara (MediaDevices.getUserMedia).';
  }
  return texto || 'No se pudo iniciar la cámara.';
}

document.addEventListener('DOMContentLoaded', () => {
  let html5QrcodeScanner = null;
  let camaraActiva = false;
  let ultimoCodigo = '';
  let ultimoEscaneoEn = 0;

  const btnToggleCamara = document.getElementById('btn-toggle-camara');
  const formManual = document.getElementById('form-manual');
  const inputCodigo = document.getElementById('input-codigo');
  const ayudaCamara = document.getElementById('camara-ayuda');

  const feedbackContainer = document.getElementById('feedback-escaneo');
  const statusIcon = document.getElementById('status-icon');
  const statusTitulo = document.getElementById('status-titulo');
  const statusMensaje = document.getElementById('status-mensaje');

  const asistenteInfo = document.getElementById('asistente-info');
  const infoNombre = document.getElementById('info-nombre');
  const infoEmail = document.getElementById('info-email');
  const infoEmpresa = document.getElementById('info-empresa');

  if (ayudaCamara) {
    if (!window.isSecureContext) {
      ayudaCamara.textContent = 'Origen no seguro: usa localhost o HTTPS para pedir permiso de cámara.';
    } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      ayudaCamara.textContent = 'Este navegador no expone MediaDevices.getUserMedia.';
    }
  }

  function procesarCodigo(codigoQR) {
    const codigoLimpio = codigoQR.trim().toUpperCase();
    if (!codigoLimpio) return;

    const ahora = Date.now();
    if (codigoLimpio === ultimoCodigo && ahora - ultimoEscaneoEn < 2500) {
      return;
    }
    ultimoCodigo = codigoLimpio;
    ultimoEscaneoEn = ahora;

    const asistentes = JSON.parse(localStorage.getItem(STORAGE_ASISTENTES) || '[]');
    const checkins = JSON.parse(localStorage.getItem(STORAGE_CHECKINS) || '[]');
    const asistenteIndice = asistentes.findIndex((a) => (a.codigo || '').toUpperCase() === codigoLimpio);

    if (asistenteIndice === -1) {
      mostrarResultado(false, 'Código no encontrado', `El pase ${codigoLimpio} no está inscrito.`, null);
      toast('Código inexistente. Este QR no corresponde a un inscrito.', 'error');
      return;
    }

    const asistente = asistentes[asistenteIndice];

    if (asistente.checkin) {
      mostrarResultado(false, 'Check-in ya realizado', `Este pase (${codigoLimpio}) ya fue usado.`, asistente);
      toast('Este pase ya hizo check-in.', 'warning');
      return;
    }

    asistentes[asistenteIndice].checkin = true;
    asistentes[asistenteIndice].fechaCheckin = new Date().toISOString();

    checkins.push({
      codigo: codigoLimpio,
      timestamp: new Date().toISOString(),
      asistenteId: asistente.id
    });

    localStorage.setItem(STORAGE_ASISTENTES, JSON.stringify(asistentes));
    localStorage.setItem(STORAGE_CHECKINS, JSON.stringify(checkins));

    mostrarResultado(true, 'Check-in exitoso', '¡Bienvenido al evento!', asistentes[asistenteIndice]);
    toast(`Check-in de ${asistente.nombre}.`, 'success');
  }

  function mostrarResultado(exito, titulo, mensaje, datosAsistente = null) {
    if (feedbackContainer) feedbackContainer.style.display = 'block';

    if (exito) {
      statusIcon.textContent = '✅';
      statusTitulo.textContent = titulo;
      statusTitulo.style.color = '#4ade80';
      statusMensaje.textContent = mensaje;
    } else {
      statusIcon.textContent = '⚠️';
      statusTitulo.textContent = titulo;
      statusTitulo.style.color = '#f87171';
      statusMensaje.textContent = mensaje;
    }

    if (datosAsistente) {
      asistenteInfo.style.display = 'block';
      infoNombre.textContent = datosAsistente.nombre || 'No registrado';
      infoEmail.textContent = datosAsistente.email || 'N/A';
      infoEmpresa.textContent = datosAsistente.empresa || 'N/A';
    } else {
      asistenteInfo.style.display = 'none';
    }
  }

  if (formManual) {
    formManual.addEventListener('submit', (e) => {
      e.preventDefault();
      const codigo = inputCodigo.value;
      if (!codigo) {
        toast('Ingresa un código de pase.', 'warning');
        return;
      }
      procesarCodigo(codigo);
      inputCodigo.value = '';
    });
  }

  if (btnToggleCamara) {
    btnToggleCamara.addEventListener('click', () => {
      if (!camaraActiva) {
        iniciarCamara();
      } else {
        detenerCamara();
      }
    });
  }

  async function iniciarCamara() {
    if (!window.isSecureContext) {
      toast(mensajeErrorCamara({ name: 'SecurityError' }), 'error');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast(mensajeErrorCamara({ name: 'NotSupportedError' }), 'error');
      return;
    }

    if (typeof Html5Qrcode === 'undefined') {
      toast('La librería de cámara no se cargó correctamente.', 'error');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        });
    } catch (err) {
      toast(mensajeErrorCamara(err), 'error');
      return;
    }

    html5QrcodeScanner = new Html5Qrcode('reader');
    html5QrcodeScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        procesarCodigo(decodedText);
        detenerCamara();
      },
      () => {}
    ).then(() => {
      camaraActiva = true;
      btnToggleCamara.textContent = 'Detener Cámara';
      btnToggleCamara.style.background = '#ef4444';
      toast('Cámara lista. Apunta al código QR del pase.', 'success');
    }).catch((err) => {
      console.error('[Scanner] Error iniciando cámara:', err);
      toast(mensajeErrorCamara(err), 'error');
    });
  }

  function detenerCamara() {
    if (html5QrcodeScanner && camaraActiva) {
      html5QrcodeScanner.stop().then(() => {
        camaraActiva = false;
        btnToggleCamara.textContent = 'Iniciar Cámara';
        btnToggleCamara.style.background = '#7c3aed';
        const reader = document.getElementById('reader');
        if (reader) reader.innerHTML = '';
      }).catch((err) => console.error('[Scanner] Error al detener:', err));
    }
  }
});
