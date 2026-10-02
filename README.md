# ◈ EventPass — Sistema de Gestión y Registro de Eventos

EventPass es una plataforma diseñada para digitalizar el control de aforo y el registro de asistentes en tiempo real. Este repositorio contiene el **Frontend (MVP)** del proyecto, estructurado como una Progressive Web App (PWA).

## 🚀 Estado Actual (Fase 1: MVP Frontend)
Actualmente, el proyecto cuenta con la interfaz de usuario completa y flujos simulados en el cliente para validar la experiencia de uso antes de la integración con el backend.

### Características Principales
*   **Landing Page & Onboarding:** Interfaz comercial orientada a la conversión de organizadores.
*   **Autenticación Simulada:** Flujo de registro e inicio de sesión para administradores utilizando almacenamiento local (`localStorage` y `sessionStorage`).
*   **Dashboard de Organizador:** Panel protegido para gestionar eventos y visualizar métricas de aforo.
*   **Generación de Pases QR:** Emisión dinámica de tickets digitales (`ticket.html`) con códigos QR funcionales (vía QRCode.js) y PIN de respaldo.
*   **PWA Ready:** Archivos base (Manifest, Service Worker) preparados para instalación offline.

## 🛠 Tecnologías Utilizadas
*   HTML5 (Estructura semántica)
*   CSS3 (Variables nativas, diseño responsivo)
*   Vanilla JavaScript (Lógica de estado y simulación de API)
*   Librerías externas: `qrcode.min.js`

## 🗺️ Roadmap (Próximos Pasos)
- [ ] **Refactorización CSS:** Migrar los estilos en línea de los componentes HTML al archivo `main.css` para una separación limpia de responsabilidades.
- [ ] **Integración de Backend:** Conectar con la API REST (Node.js/Express) y base de datos (MongoDB).
- [ ] **Escáner QR App Móvil:** Integrar la lógica del escáner nativo para validar los pases generados.

---
*Desarrollado para la presentación MVP.*
