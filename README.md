# 🐾 BAS Pet Shop — Frontend

SPA (Single Page Application) para el sistema de gestión de la forrajería BAS, construida con React 19, TypeScript y Vite 7. Incluye la tienda pública (catálogo, carrito y pedido por WhatsApp) y el panel de administración (dashboard, catálogo, ventas y caja).

## 🛠️ Stack Tecnológico

- **React 19** + **TypeScript 5.9** — UI
- **Vite 7** — build tool y dev server
- **TailwindCSS 4** — estilos utility-first
- **Zustand** (con `persist`) — estado global: auth, carrito y datos de cliente
- **React Hook Form + Zod** — formularios con validación
- **shadcn/ui + Radix UI** — componentes accesibles
- **Axios** — cliente HTTP
- **React Router DOM 7** — navegación SPA
- **reCAPTCHA v3** — protección del flujo de pedido por WhatsApp
- **Sonner** — notificaciones toast
- **Lucide React** — iconografía
- **vite-plugin-pwa** — PWA (manifest + service worker)

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno (ver sección siguiente)
cp .env.example .env.local

# Iniciar servidor de desarrollo
npm run dev
```

## 🔧 Variables de entorno

Copiá `.env.example` a `.env.local` y ajustá los valores reales.

| Variable              | Requerida | Descripción                                                             |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| `VITE_API_URL`        | Sí        | URL base del backend REST (Axios y proxy de Vite).                      |
| `NEXT_PUBLIC_API_URL` | No        | Alternativa a `VITE_API_URL`; si se define, tiene prioridad sobre ella. |

> Las credenciales de administrador **no** van en el frontend: el login admin se hace contra el backend vía `POST /auth/admin/login` (email + contraseña), que devuelve un JWT. Las variables `VITE_ADMIN_*` y `VITE_API_URLS` (del sistema de failover, hoy eliminado) ya no existen.

## 🚀 Scripts

| Script                  | Descripción                                        |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Inicia el servidor de desarrollo                   |
| `npm run build`         | Compila TypeScript y genera el build de producción |
| `npm run preview`       | Previsualiza el build de producción                |
| `npm run lint`          | Ejecuta ESLint sobre todo el proyecto              |
| `npm run lint:fix`      | Ejecuta ESLint aplicando fixes automáticos         |
| `npm run format`        | Formatea todo el proyecto con Prettier             |
| `npm run test`          | Corre los tests con Vitest (modo run)              |
| `npm run test:watch`    | Corre los tests en modo watch                      |
| `npm run test:coverage` | Corre los tests con reporte de cobertura           |

## 📁 Estructura del Proyecto

```
src/
├── infrastructure/     # servicios HTTP (products/orders), cliente Axios y stores Zustand
│   └── utils/          # logger con logs gateados por entorno (devLog/devWarn/devError)
├── lib/                # helpers puros (format, lifeStage, validation, cn)
├── routing/            # AppRouter, ProtectedRoute y puente de navegación global
├── test/               # setup de tests (jest-dom)
└── ui/
    ├── components/     # componentes de negocio + ui/ (shadcn)
    ├── layouts/        # AdminLayout
    └── pages/          # Home, Login, GoogleCallback y páginas del panel admin
```

## 🔐 Autenticación

- **Login con Google**: el botón redirige a `GET /auth/google` del backend. El callback (`/auth/google/callback`) persiste la sesión y redirige al panel.
- **Login admin**: formulario en `/login` → `POST /auth/admin/login` (email + contraseña) → devuelve el JWT.
- **Rutas protegidas**: `/admin/*` pasa por `ProtectedRoute`, que valida la sesión contra `GET /auth/me`.
- El JWT se guarda en `localStorage` (zustand `persist`). ⚠️ Es un **trade-off documentado** en `auth_session_manager.ts`: el cierre ideal (cookie `httpOnly` con el JWT, no expuesto al JavaScript) requiere cambios en el **backend**, fuera de este repo.

## 🛒 Pedido por WhatsApp con reCAPTCHA v3

1. El cliente arma el carrito y completa nombre y teléfono.
2. Al enviar, se obtiene un token de reCAPTCHA v3 (`getRecaptchaToken`).
3. Se llama a `POST /orders/whatsapp-link` enviando el header `x-recaptcha-token`; el backend valida el carrito y el token, y devuelve el link de WhatsApp.
4. Se abre WhatsApp con el detalle del pedido (nunca se arma el link a mano en el cliente).

## 📱 PWA

El proyecto usa `vite-plugin-pwa` (manifest + service worker con `autoUpdate`). Los íconos viven en `public/`:

- `pwa-192x192.png` y `pwa-512x512.png` (manifest)
- `apple-touch-icon.png`, `favicon.ico` y `masked-icon.svg`

> ⚠️ Los íconos actuales son **placeholders** generados (cuadrados azules con una "B"). Falta reemplazarlos por los definitivos.

## ✅ Calidad y tooling

- **ESLint** (flat config: `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks`) integrado con **Prettier** vía `eslint-config-prettier`.
- **Vitest + React Testing Library** (jsdom): **24 tests** que cubren carrito, cálculo de presentaciones (bolsa/kilo), validación del formulario de producto (Zod), `ProtectedRoute` y `orders.service` (con la API mockeada).
- **Code-splitting**: las páginas del panel admin cargan con `React.lazy` + `Suspense`, lo que redujo el bundle inicial de ~206 kB a ~144 kB gzip.

## 📋 Estado de la auditoría (resumen de lo resuelto)

- **Dependencias**: 0 vulnerabilidades (`npm audit`), tras actualizar vite, react-router-dom, axios y dependencias transitivas.
- **Código muerto eliminado**: residuos del template de Vite, `failover-client`, `AdminLogin` (login hardcodeado), util duplicado `cn`, etc.
- **Auth endurecida**: logout selectivo (no borra carrito ni datos de cliente), navegación SPA, sin credenciales hardcodeadas y mitigación para que el token de Google no quede en el historial. **Pendiente backend**: cookie `httpOnly` y JWT en cookie para cerrar el flujo por completo.
- **Performance**: code-splitting, doble fetch de categorías resuelto y logs gateados por entorno.

## 🔧 Requisitos

- Node.js **20.19+** o **22.12+** (build/dev con Vite 7).
- Tests (jsdom 30): Node **22.22+**, **24.15+** o **26+**.
- npm 9+.

## 📄 Licencia

Proyecto privado — Todos los derechos reservados.
