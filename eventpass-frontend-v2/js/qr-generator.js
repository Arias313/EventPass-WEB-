// ============================================================
// qr-generator.js — Generador y Renderizador de QR para EventPass
// ============================================================

const EventPassQR = {
  /**
   * Genera el código QR sobre un elemento Canvas de HTML5.
   * @param {string} texto - El contenido/código a codificar
   * @param {string} canvasId - ID del elemento <canvas>
   */
  async generarEnCanvas(texto, canvasId = 'ticket-qr-canvas') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
      console.error(`[QR Generator] No se encontró el elemento #${canvasId}`);
      return false;
    }

    if (window.QRCode && window.QRCode.toCanvas) {
      try {
        await window.QRCode.toCanvas(canvas, texto, {
          width: 180,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        console.log(`[QR Generator] QR renderizado con éxito: ${texto}`);
        return true;
      } catch (error) {
        console.error('[QR Generator] Error al dibujar en canvas:', error);
        return false;
      }
    } else {
      // Dibujo de contingencia si no cargó la librería CDN
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7c3aed';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR Pase', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillText(texto, canvas.width / 2, canvas.height / 2 + 10);
      return false;
    }
  },

  /**
   * Descarga la imagen del QR en formato PNG.
   */
  descargarPNG(canvasId = 'ticket-qr-canvas', nombreArchivo = 'Pase-EventPass.png') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const enlace = document.createElement('a');
    enlace.download = nombreArchivo;
    enlace.href = canvas.toDataURL('image/png');
    enlace.click();
  }
};