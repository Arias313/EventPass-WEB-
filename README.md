# 🌐 EventPass WEB — Plataforma de Gestión de Eventos y API REST

Plataforma web integral para la creación, administración y control de acceso a eventos en tiempo real. Este repositorio alberga el **Frontend PWA** (Vanilla JavaScript) y la **API REST Backend** (Node.js/Express + MongoDB Atlas), diseñada para interactuar tanto con la web como con la **App Móvil Android Escáner**.

---

## 🔗 Ecosistema EventPass

| Componente | Descripción | Repositorio |
| :--- | :--- | :--- |
| **🌐 EventPass WEB (API & Admin)** | Dashboard web para organizadores, API REST pública/privada y generación de pases QR. | [github.com/Arias313/EventPass-WEB-](https://github.com/Arias313/EventPass-WEB-) |
| **📱 EventPass App (Escáner Móvil)** | Aplicación nativa Android (Kotlin + Jetpack Compose) para escaneo rápido de QR e ingreso. | [Ver Repositorio Móvil](https://github.com/Arias313/EventPass-app-) |

---

## 📱 Vistas Implementadas y Funciones Clave

1. **Panel de Administración (Dashboard):** gestión de eventos (creación, edición, eliminación), métricas de aforo y lista de asistentes registrados.
2. **Registro e Inicio de Sesión (JWT):** autenticación de administradores con token JWT. Opción "mantener la sesión" (`localStorage`) o sesión temporal (`sessionStorage`). Registro de administradores protegido opcionalmente con código de invitación.
3. **Página Pública de Registro y Pases (`registro.html` / `ticket.html`):** formulario para que los asistentes soliciten su entrada y reciban un pase digital con **código QR** y **PIN único**.
4. **API REST de Validación:** endpoints de check-in (en vivo y por lotes offline) para la web y la App Móvil.

---

## 🏛️ Arquitectura y Lógica del Sistema

Arquitectura **Fullstack Desacoplada**:

* **Backend RESTful:** controladores por responsabilidad (`eventoController`, `asistenteController`, `authController`), reserva de aforo atómica en MongoDB para evitar sobreventa y middleware de autenticación.
* **Frontend (`EPStore`):** módulo centralizado de peticiones (`fetch`) con encabezados JWT, tiempo de espera de 8 s, distinción entre errores de red y de servidor, y normalización de respuestas. No guarda datos personales de asistentes en el navegador.
* **PWA:** `Service Worker` (caché versionada, solo guarda scripts con tipo de contenido JavaScript) y `manifest.json` con rutas relativas.

### 🔒 Seguridad implementada

* **Datos:** índice único `{ evento, cedula }` (cédula normalizada) e índice único global de `PIN`.
* **Pase:** el PIN es `EP-` + 16 caracteres hexadecimales aleatorios (`crypto.randomBytes`). La consulta pública y el check-in buscan **solo por PIN**; la cédula se devuelve enmascarada.
* **Red:** `helmet`, `trust proxy`, límite de cuerpo JSON (100 kb) y CORS por lista de orígenes. En producción el servidor **no arranca** si `CORS_ORIGIN` falta o contiene `*`.
* **Abuso:** límites de peticiones por IP (`express-rate-limit`) en login, registro de administradores, registro de asistentes y consulta de pases.
* **Errores:** en producción las respuestas 500 son genéricas; el detalle se registra solo en el servidor.
* **Dependencias:** `npm audit --omit=dev` sin vulnerabilidades.

---

## 🛠️ Tecnologías y Herramientas

### Backend (API REST)
* **Runtime:** Node.js · **Framework:** Express.js
* **Base de Datos:** MongoDB Atlas (Mongoose)
* **Seguridad:** JWT, Bcrypt, Helmet, express-rate-limit, CORS, Dotenv

### Frontend (PWA)
* HTML5, CSS3 (variables nativas, Flexbox/Grid), Vanilla JavaScript (ES6+)
* `qrcode.min.js` local (sin CDN), Service Worker, Web App Manifest
* **Almacenamiento:** `sessionStorage` / `localStorage` (token JWT) y `localStorage` (caché de eventos)

### Entorno
* VS Code, Git / GitHub, Live Server (desarrollo local)

---

## ⚙️ Puesta en marcha local

```bash
cd eventpass-backend
npm install
cp .env.example .env     # completa los valores (nunca subas el .env)
npm run dev
```

Variables de entorno (ver `.env.example`): `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `NODE_ENV`, `LOGIN_LIMIT`, `ADMIN_INVITE_CODE`.

Frontend: abrir `eventpass-frontend-v2/` con Live Server (por defecto `http://127.0.0.1:5501`).

---

## 🚀 Roadmap y Estado del Proyecto

### 🟢 Fase 1: MVP Frontend y Maquetación
- [x] Landing Page comercial e informativa.
- [x] Vistas de autenticación (`login.html`, `registro-admin.html`).
- [x] Dashboard administrativo de eventos (`index-administrador.html`).
- [x] Generación de pases digitales con QR (`ticket.html`).

### 🟢 Fase 2: Conexión Fullstack & API Backend
- [x] Modelos Mongoose (`Evento.js`, `Asistente.js`, `Admin.js`).
- [x] Endpoints privados de eventos con JWT.
- [x] Endpoint público de autorregistro de asistentes y generación de PIN.
- [x] Vinculación del frontend `EPStore` con MongoDB Atlas.
- [x] Limpieza de secretos y credenciales (`.env`, `.env.example`).

### 🟡 Fase 3: Robustecimiento (Fase Actual)
- [x] Errores de la API visibles en los formularios (cédula duplicada, aforo lleno, sesión caducada).
- [x] Librería QR local sin depender de CDN.
- [x] Service Worker versionado y con validación del tipo de contenido.
- [x] Índices únicos, endpoint público por PIN con datos enmascarados y check-in solo por PIN.
- [x] Límites de peticiones, `helmet`, CORS estricto y errores genéricos en producción.
- [x] Código de invitación para el registro de administradores.
- [x] Dependencias de producción sin vulnerabilidades.
- [ ] Verificar que el Service Worker no cachee peticiones `POST/PUT` de la API.
- [ ] Validación de entradas con `express-validator`.
- [ ] Transacciones en el registro de asistentes y en el borrado de eventos.
- [ ] Eliminar el N+1 de `listarMisEventos`.
- [ ] Pruebas automatizadas (Jest + Supertest).
- [ ] Validación de lectura del QR desde la **App Móvil Android**.

### 🔵 Fase 4: Despliegue
- [ ] Backend en Render/Railway con variables de entorno de producción.
- [ ] Frontend en Netlify/Vercel/Cloudflare Pages.
- [ ] HTTPS, `CORS_ORIGIN` y `API_BASE` apuntando a los dominios reales.
- [ ] Almacén compartido para los límites de peticiones si se usa más de una instancia.

---

## 📌 Cierre de Bitácora

* **Última actualización:** 8 de octubre de 2026
* **Resumen de cambios:** corrección del fallo de carga de `EPStore` (caché del Service Worker), endurecimiento del backend (índices únicos, pases por PIN con datos enmascarados, límites de peticiones, CORS estricto, errores genéricos, código de invitación) y actualización de dependencias. Migración de cédulas verificada en seco: sin colisiones ni cambios pendientes.
