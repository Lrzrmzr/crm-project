Plan: CRM Básico — React + Node.js + FastAPI + PostgreSQL
Context
El usuario es desarrollador PHP/Laravel que quiere aprender React+TypeScript, Node.js+Express y FastAPI construyendo un CRM básico. El stack elegido es intencionalmente diferente a su stack actual para maximizar el aprendizaje. El proyecto vive en c:\laragon\www\crm-project. Node.js (v24), Python (3.12), y PostgreSQL ya están instalados.

Módulos del CRM
Módulo	Descripción
Auth	Login/Register con JWT (email + password). Refresh token en httpOnly cookie.
Usuarios	Gestión de usuarios internos del CRM (admin, agent).
Contactos	Personas (clientes potenciales y actuales).
Empresas	Organizaciones a las que pertenecen los contactos.
Leads	Oportunidades en etapa temprana (pipeline: new → contacted → qualified → converted → lost).
Deals	Oportunidades formales con valor monetario y etapa de venta (prospecting → won/lost).
Actividades	Log de interacciones: llamadas, emails, reuniones, notas.
Reportes	Generados por FastAPI: pipeline, conversión, actividad.
IA (Claude)	Lead scoring y sugerencias via Anthropic API en FastAPI.
Estructura del Proyecto (Monorepo)
crm-project/
├── .gitignore
├── .env.example
├── frontend/          # React + TypeScript (Vite)
├── backend/           # Node.js + Express + TypeScript + Prisma
└── microservice/      # Python FastAPI
Frontend frontend/src/
├── assets/
├── components/
│   ├── ui/            # Button, Input, Modal, Table, Badge
│   ├── layout/        # Sidebar, TopNav, PageWrapper
│   └── forms/
├── features/          # ← patrón principal (feature-based)
│   ├── auth/          # LoginPage, hooks, auth.api.ts
│   ├── contacts/
│   ├── leads/         # LeadKanban (vista tipo Trello)
│   ├── deals/
│   ├── activities/
│   └── reports/       # Recharts + datos de FastAPI vía Node
├── hooks/             # hooks globales: useDebounce, usePagination
├── lib/
│   ├── axios.ts       # instancia con interceptores de token
│   └── queryClient.ts
├── store/
│   └── authStore.ts   # Zustand: user en memoria, flag de expiración
├── types/             # interfaces TS compartidas
├── utils/             # formatDate, formatCurrency
└── router/
    ├── index.tsx
    └── ProtectedRoute.tsx
Backend backend/src/
├── config/
│   ├── env.ts         # valida env vars con Zod, exporta config tipado
│   ├── database.ts    # Prisma client singleton
│   └── logger.ts      # instancia de pino
├── middleware/
│   ├── auth.middleware.ts      # verifyAccessToken → req.user
│   ├── error.middleware.ts     # manejador global de errores
│   ├── validate.middleware.ts  # wrapper de validación Zod
│   └── rateLimit.middleware.ts
├── modules/           # ← patrón por capas dentro de cada módulo
│   ├── auth/          # routes → controller → service → schema
│   ├── users/
│   ├── contacts/
│   ├── companies/
│   ├── leads/
│   ├── deals/
│   ├── activities/
│   └── reports/       # proxies calls a FastAPI
├── types/
│   └── express.d.ts   # extiende Request con req.user
└── utils/
    ├── jwt.utils.ts              # sign/verify access + refresh tokens
    ├── hash.utils.ts             # bcryptjs wrappers
    ├── response.utils.ts         # ApiResponse<T> estandarizado
    └── microservice.client.ts    # axios para llamadas internas a FastAPI
Microservice microservice/app/
├── main.py            # FastAPI app, CORS, lifespan
├── config.py          # pydantic-settings: lee .env
├── database.py        # SQLAlchemy async engine
├── dependencies.py    # get_db, get_current_user
├── auth/
│   └── jwt_validator.py   # valida JWT de Node.js (secreto compartido)
├── routers/
│   ├── reports.py     # /reports/pipeline, /reports/conversion
│   ├── leads_ai.py    # /ai/score-lead, /ai/deal-insights
│   └── health.py
├── schemas/           # Pydantic models (request/response)
├── services/
│   ├── pipeline_service.py
│   ├── conversion_service.py
│   └── ai_service.py  # Claude API (AsyncAnthropic)
└── models/            # SQLAlchemy ORM (solo lectura, Prisma maneja migraciones)
Autenticación JWT
Patrón: Access Token en memoria + Refresh Token en httpOnly cookie.

Login
  │
  ├─→ Node.js verifica email/password con bcryptjs
  ├─→ Genera Access Token JWT (15 min, HS256)
  ├─→ Genera Refresh Token (string random, hashed en DB, 7 días)
  │
  ├─→ Respuesta JSON: { accessToken, user }
  └─→ Set-Cookie: refreshToken=...; HttpOnly; SameSite=Lax; Path=/api/auth/refresh

React guarda accessToken en Zustand (memoria, NO localStorage).
Axios interceptor → inyecta Authorization: Bearer <token>.
Axios interceptor en 401 → llama /api/auth/refresh automáticamente.
FastAPI valida el mismo JWT con python-jose + el mismo JWT_SECRET.
Por qué no localStorage: Es accesible por cualquier JS en la página (vulnerable a XSS). La cookie httpOnly es invisible para JavaScript.

Sobre OAuth 2 / Google Login: Se puede agregar en Fase 2 con Passport.js (passport-google-oauth20) en el backend. Para el primer sprint se recomienda empezar con email/password para entender el flujo completo sin la complejidad adicional de OAuth.

Comunicación entre Servicios
React (:5173) ──HTTP──► Node.js (:4000)
                              │
                              └──HTTP interno──► FastAPI (:8000)
                                                      │
                              Node.js (:4000) ◄───────┘
                                    │
                              PostgreSQL (:5432) ◄─── FastAPI también
React nunca llama directamente a FastAPI.
Node proxies todas las peticiones de reportes/IA a FastAPI.
Autenticación interna: Node reenvía el JWT del usuario a FastAPI (cabecera Authorization: Bearer).
FastAPI lo valida con el mismo JWT_SECRET compartido.
FastAPI es solo lectura en la DB. Prisma (desde Node) es el dueño de las migraciones.
Variables de Entorno
backend/.env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://crm_user:password@localhost:5432/crm_db
JWT_SECRET=<string_aleatorio_64+_chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FASTAPI_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
microservice/.env
APP_ENV=development
PORT=8000
DATABASE_URL=postgresql+asyncpg://crm_user:password@localhost:5432/crm_db
JWT_SECRET=<EXACTAMENTE_IGUAL_que_backend>
JWT_ALGORITHM=HS256
ANTHROPIC_API_KEY=sk-ant-...
frontend/.env
VITE_API_URL=http://localhost:4000/api
Dependencias por Capa
Frontend
npm create vite@latest frontend -- --template react-ts
npm install react-router-dom @tanstack/react-query axios zustand \
  react-hook-form zod @hookform/resolvers recharts date-fns \
  react-hot-toast lucide-react
npm install -D tailwindcss @tailwindcss/vite prettier eslint
Backend
npm install express @prisma/client zod jsonwebtoken bcryptjs \
  cookie-parser cors helmet express-rate-limit pino pino-pretty axios dotenv
npm install -D prisma typescript ts-node-dev \
  @types/express @types/node @types/jsonwebtoken @types/bcryptjs \
  @types/cookie-parser @types/cors
Nota: Usar bcryptjs (no bcrypt). bcrypt requiere compilación nativa en Windows (node-gyp) y falla frecuentemente. bcryptjs es pure JavaScript, instalación sin fricción.

Microservice
python -m venv venv && venv\Scripts\activate
pip install fastapi "uvicorn[standard]" pydantic pydantic-settings \
  sqlalchemy asyncpg "python-jose[cryptography]" httpx anthropic python-dotenv
pip freeze > requirements.txt
Orden de Implementación (paso a paso)
Fase 1 — Infraestructura
mkdir crm-project && git init
Crear base de datos PostgreSQL: CREATE DATABASE crm_db;
Crear .gitignore raíz (node_modules, .env, pycache, venv, dist)
Fase 2 — Backend (Node.js)
npm init + instalar dependencias
npx prisma init → escribir schema con todos los modelos → prisma migrate dev --name init
Crear estructura de carpetas src/
Implementar jwt.utils.ts y hash.utils.ts (base de auth)
Implementar módulo auth completo → probar con REST Client antes de continuar
Implementar módulos CRUD: users → contacts → companies → leads → deals → activities
Implementar módulo reports (proxy a FastAPI — puede ser stub al inicio)
Fase 3 — Microservice (FastAPI)
python -m venv venv + instalar dependencias
Crear estructura de carpetas app/
Implementar jwt_validator.py → probar con token real del paso 8
Implementar router de reportes (pipeline SQL simple)
Implementar ai_service.py con Claude API para lead scoring
Fase 4 — Frontend (React)
npm create vite@latest frontend -- --template react-ts
Configurar Tailwind CSS
Implementar axios.ts con interceptores (token injection + refresh automático)
Implementar authStore.ts (Zustand)
Implementar LoginPage + ProtectedRoute → probar login completo
Implementar features: contacts → leads (Kanban) → deals → activities → reports
Fase 5 — Integración y Pruebas
Ejecutar los 3 servicios simultáneamente (3 terminales)
Flujo E2E: Register → Login → Crear contacto → Crear lead → Convertir a deal → Ver reporte
Verificación Final
Levantar los 3 servicios:

# Terminal 1
cd backend && npm run dev

# Terminal 2
cd microservice && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Terminal 3
cd frontend && npm run dev
Checklist de prueba:

 Register → Login → tokens recibidos correctamente
 Refresh automático cuando expira el access token
 Logout elimina cookie y borra estado Zustand
 CRUD completo de contactos y leads
 Pipeline Kanban de leads funcional
 Reporte de pipeline carga datos de FastAPI
 Lead scoring devuelve respuesta de Claude AI
 FastAPI /health responde correctamente
Archivos Críticos (implementar primero)
Archivo	Por qué es crítico
backend/prisma/schema.prisma	Define toda la estructura de datos
backend/src/utils/jwt.utils.ts	Base de toda la autenticación
backend/src/modules/auth/auth.service.ts	Login/refresh/logout
frontend/src/lib/axios.ts	Interceptores de token (si falla, nada funciona)
microservice/app/auth/jwt_validator.py	Seguridad del microservicio