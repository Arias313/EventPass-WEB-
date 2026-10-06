# 🌐 EventPass WEB — Plataforma de Gestión de Eventos y API REST

Plataforma web integral para la creación, administración y control de acceso a eventos en tiempo real. Este repositorio alberga el **Frontend PWA** (Vanilla JavaScript) y la **API REST Backend** (Node.js/Express + MongoDB Atlas), diseñada para interactuar tanto con la web como con la **App Móvil Android Escáner**.

---

## 🔗 Ecosistema EventPass

El sistema EventPass está dividido en dos componentes principales interconectados:

| Componente | Descripción | Repositorio |
| :--- | :--- | :--- |
| **🌐 EventPass WEB (API & Admin)** | Dashboard web para organizadores, API REST pública/privada y generación de pases QR. | [github.com/Arias313/EventPass-WEB-](https://github.com/Arias313/EventPass-WEB-) |
| **📱 EventPass App (Escáner Móvil)** | Aplicación nativa Android (Kotlin + Jetpack Compose) para escaneo rápido de QR e ingreso. | [Ver Repositorio Móvil](https://github.com/Arias313/EventPass-app-) |

---

## 📱 Vistas Implementadas y Funciones Clave

1. **Panel de Administración (Dashboard):** Gestión completa de eventos (creación, edición, eliminación), métricas de aforo acumulado y visualización de asistentes registrados.
2. **Registro e Inicio de Sesión (JWT):** Autenticación de administradores con persistencia de sesión segura mediante tokens JWT.
3. **Página Pública de Registro y Pases (`ticket.html`):** Formulario directo para que los asistentes soliciten su entrada, generando dinámicamente un boleto digital con **código QR nativo** y **PIN único de respaldo**.
4. **API REST de Validación:** Endpoints listos para recibir peticiones de confirmación de ingreso (*check-in*) desde el Frontend Web o la App Móvil.

---

## 🏛️ Arquitectura y Lógica del Sistema

El proyecto sigue una arquitectura **Fullstack Desacoplada** preparada para operar con alta disponibilidad:

* **Backend RESTful:** Controladores divididos por responsabilidad (`eventoController`, `asistenteController`), validaciones atómicas de aforo en MongoDB para evitar sobreventa y middleware de autenticación por roles.
* **Frontend reactivo en cliente (`EPStore`):** Módulo centralizado que gestiona las peticiones asíncronas (`fetch`), inyecta los encabezados JWT y normaliza la respuesta del servidor hacia las vistas.
* **Arquitectura PWA:** Integración de `Service Worker` y `manifest.json` para instalación web y estrategias de almacenamiento en caché.

---

## 🛠️ Tecnologías y Herramientas

### Backend (API REST)
* **Runtime:** Node.js
* **Framework:** Express.js
* **Base de Datos:** MongoDB Atlas (Mongoose ORM)
* **Seguridad:** JSON Web Tokens (JWT), Bcrypt, CORS, Dotenv

### Frontend (PWA)
* **Lenguajes:** HTML5, CSS3 (Variables nativas & Flexbox/Grid), Vanilla JavaScript (ES6+)
* **Librerías:** `qrcode.min.js` (Generación de matriz QR en cliente)
* **Almacenamiento:** `sessionStorage` (Token JWT) / `localStorage` (Ajustes de cliente)
* **Entorno PWA:** Service Worker API, Web App Manifest

### Herramientas & Entorno
* **Entorno:** VS Code, Git / GitHub
* **Despliegue Local:** Live Server HTTP

---

## 🚀 Roadmap y Estado del Proyecto (Sistema de Avance)

Utiliza esta sección para monitorear las fases completadas y los siguientes objetivos a integrar:

### 🟢 Fase 1: MVP Frontend y Maquetación
- [x] Landing Page comercial e informativa.
- [x] Vistas de autenticación (`login.html`, `registro-admin.html`).
- [x] Dashboard administrativo de eventos (`index-administrador.html`).
- [x] Generación de pases digitales con QR (`ticket.html`).

### 🟡 Fase 2: Conexión Fullstack & API Backend (Fase Actual)
- [x] Creación de modelos de datos Mongoose (`Evento.js`, `Asistente.js`).
- [x] Endpoints privados para creación y gestión de eventos con JWT.
- [x] Endpoint público para autorregistro de asistentes y generación de PIN.
- [x] Vinculación exitosa del frontend `EPStore` con MongoDB Atlas.
- [x] Limpieza de secretos y credenciales harcodeadas (`.env`).

### 🔵 Fase 3: Robustecimiento, Errores y Modo Offline (Próxima Sesión)
- [ ] Mapeo con `try/catch` en formularios frontend para capturar errores de API (ej. correo duplicado, aforo lleno).
- [ ] Optimización del `service-worker.js` para evitar cachear peticiones `POST/PUT` de la API.
- [ ] Corrección de rutas de librerías locales QR sin depender de CDN externos.
- [ ] Validación de lectura del código QR generado desde la **App Móvil Android**.

---

## 📌 Cierre de Bitácora

* **Última Actualización:** 6 de Octubre de 2026
* **Resumen de Cambios:** Unificación de modelos de base de datos, creación de la ruta pública de registro de asistentes y resolución del árbol de commits/merge con el repositorio remoto.
