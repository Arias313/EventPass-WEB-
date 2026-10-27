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

Arquitectura **Fullstack Híbrida (Desacoplada o Unificada)**:

- **Backend RESTful:** controladores por responsabilidad, reserva de aforo atómica en MongoDB para evitar sobreventa y middleware de autenticación.
- **Frontend Dinámico (`EPStore` / `config.js`):** módulo centralizado de peticiones con resolución dinámica de la `API_BASE` en 5 niveles (URL params, meta tags, origen local/nube), lo que evita hardcodes de `localhost`.
- **Modo Producción Unificado:** Capacidad del backend de servir toda la PWA estática si `SERVE_FRONTEND=true` está activo, eliminando problemas de CORS al operar bajo el mismo dominio y puerto.
- **PWA:** `Service Worker` (caché versionada, ignorando rutas `/health` o `POST/PUT`) y `manifest.json` con rutas relativas a prueba de subdirectorios.

### 🔒 Seguridad implementada

- **Datos:** índice único `{ evento, cedula }` (cédula normalizada) e índice único global de `PIN`. Conexión abierta (`0.0.0.0/0`) en MongoDB Atlas para soportar clústeres en la nube (Render).
- **Pase:** el PIN es `EP-` + 16 caracteres hexadecimales aleatorios. La consulta y el check-in buscan **solo por PIN**; la cédula se devuelve enmascarada.
- **Red:** `helmet`, `trust proxy`, CORS dinámico no bloqueante (permite que el contenedor arranque en la nube sin crashear) y enlace estricto a `HOST=0.0.0.0`.
- **Abuso:** límites de peticiones por IP (`express-rate-limit`) en procesos críticos.

---

## 🛠️ Tecnologías y Herramientas

### Backend (API REST)
- **Runtime:** Node.js (>=18) · **Framework:** Express.js
- **Base de Datos:** MongoDB Atlas (Mongoose)
- **Seguridad:** JWT, Bcrypt, Helmet, express-rate-limit, CORS, Dotenv

### Frontend (PWA)
- HTML5, CSS3 (variables nativas, Flexbox/Grid), Vanilla JavaScript (ES6+)
- `qrcode.min.js` local, Service Worker, Web App Manifest

---

## ⚙️ Puesta en marcha

**Modo Unificado (Recomendado para Producción y Pruebas Globales):**
```bash
# En la raíz del repositorio
npm install          # Ejecuta el postinstall automáticamente para el backend
cp .env.example .env # Completa los valores (MONGODB_URI, JWT_SECRET, etc.)
npm start            # Inicia el backend (sirve la PWA si SERVE_FRONTEND=true)
