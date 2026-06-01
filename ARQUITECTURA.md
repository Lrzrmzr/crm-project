# CRM Básico — Arquitectura del Proyecto

## Stack Tecnológico

| Capa | Tecnología | Puerto |
|---|---|---|
| Frontend | React + TypeScript (Vite) | :5173 |
| Backend API | Node.js + Express + TypeScript | :4000 |
| Microservicio | Python FastAPI | :8000 |
| Base de datos relacional | PostgreSQL | :5432 |
| Base de datos documental | MongoDB | :27017 |

---

## Módulos del CRM

| Módulo | Descripción | DB |
|---|---|---|
| Auth | Login/Register con JWT (email + password). Refresh token en httpOnly cookie. | PostgreSQL |
| Usuarios | Gestión de usuarios internos del CRM (admin, agent). | PostgreSQL |
| Contactos | Personas (clientes potenciales y actuales). | PostgreSQL |
| Empresas | Organizaciones a las que pertenecen los contactos. | PostgreSQL |
| Leads | Pipeline: new → contacted → qualified → converted → lost. | PostgreSQL |
| Deals | Oportunidades con valor monetario y etapa de venta. | PostgreSQL |
| Actividades | Log de interacciones: llamadas, emails, reuniones, notas. | **MongoDB** |
| Audit Log | Registro de cada cambio en el sistema (quién cambió qué). | **MongoDB** |
| Reportes | Pipeline, conversión, actividad — generados por FastAPI. | Ambas |
| IA (Claude) | Lead scoring y sugerencias via Anthropic API en FastAPI. | Ambas |

---

## ¿Por qué MongoDB para Actividades y Auditoría?

Cada tipo de actividad tiene campos completamente distintos — MongoDB maneja
esto de forma natural sin necesidad de columnas vacías o tablas extra:

```js
// Llamada
{ type: "call", duration: 320, outcome: "answered", recording_url: "..." }

// Email
{ type: "email", subject: "...", body: "...", attachments: [{ name, url }] }

// Reunión
{ type: "meeting", location: "...", attendees: ["uuid1","uuid2"], agenda: "..." }

// Nota
{ type: "note", content: "...", pinned: true }
```

El Audit Log es append-only con alto volumen y estructura variable por entidad —
otro caso clásico de MongoDB.

---

## Distribución de Bases de Datos

```
PostgreSQL → datos relacionales y consistentes
  - users, refresh_tokens
  - companies, contacts
  - leads, deals

MongoDB → documentos semi-estructurados y logs
  - activities     (colección)
  - audit_logs     (colección)
```

---

## Esquema PostgreSQL (Prisma)

### users
```
id              UUID PK (gen_random_uuid)
name            VARCHAR(255)
email           VARCHAR(255) UNIQUE
password_hash   VARCHAR(255)
role            VARCHAR(50) DEFAULT 'agent'   -- 'admin' | 'agent'
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### refresh_tokens
```
id              UUID PK
user_id         UUID → users(id) ON DELETE CASCADE
token_hash      VARCHAR(255)
expires_at      TIMESTAMPTZ
revoked_at      TIMESTAMPTZ (null = válido)
created_at      TIMESTAMPTZ
```

### companies
```
id              UUID PK
name            VARCHAR(255)
industry        VARCHAR(100)
website         VARCHAR(255)
phone           VARCHAR(50)
address         TEXT
created_by      UUID → users(id)
created_at / updated_at  TIMESTAMPTZ
```

### contacts
```
id              UUID PK
first_name      VARCHAR(100)
last_name       VARCHAR(100)
email           VARCHAR(255)
phone           VARCHAR(50)
company_id      UUID → companies(id) ON DELETE SET NULL
assigned_to     UUID → users(id)
notes           TEXT
created_by      UUID → users(id)
created_at / updated_at  TIMESTAMPTZ
```

### leads
```
id              UUID PK
title           VARCHAR(255)
contact_id      UUID → contacts(id)
assigned_to     UUID → users(id)
status          VARCHAR(50)  -- new|contacted|qualified|converted|lost
source          VARCHAR(100) -- web|referral|cold_call|...
estimated_value NUMERIC(12,2)
notes           TEXT
created_by      UUID → users(id)
created_at / updated_at  TIMESTAMPTZ
```

### deals
```
id              UUID PK
title           VARCHAR(255)
lead_id         UUID → leads(id)
contact_id      UUID → contacts(id)
assigned_to     UUID → users(id)
stage           VARCHAR(50)  -- prospecting|proposal|negotiation|won|lost
value           NUMERIC(12,2)
expected_close  DATE
closed_at       TIMESTAMPTZ
notes           TEXT
created_by      UUID → users(id)
created_at / updated_at  TIMESTAMPTZ
```

---

## Esquema MongoDB (Mongoose)

### Colección: `activities`

Cada documento referencia entidades de PostgreSQL por su UUID (string).

```js
{
  _id: ObjectId,
  type: "call" | "email" | "meeting" | "note" | "task",

  // referencia polimórfica a PostgreSQL
  entity_type: "contact" | "lead" | "deal",
  entity_id: "uuid-string",         // UUID de PostgreSQL

  performed_by: "uuid-string",      // UUID del user en PostgreSQL
  performed_at: Date,

  // campos comunes
  subject: String,
  description: String,

  // campos específicos por tipo (opcionales según tipo)
  // call
  duration: Number,                 // segundos
  outcome: String,                  // answered|no_answer|voicemail
  recording_url: String,

  // email
  body: String,
  attachments: [{ name: String, url: String, size: Number }],

  // meeting
  location: String,
  attendees: [String],              // UUIDs de users
  agenda: String,

  // task
  due_date: Date,
  completed: Boolean,
  completed_at: Date,

  created_at: Date,
  updated_at: Date
}
```

**Índices recomendados:**
```js
{ entity_type: 1, entity_id: 1 }   // buscar actividades de un contacto/lead/deal
{ performed_by: 1 }                  // actividades por usuario
{ performed_at: -1 }                 // orden cronológico descendente
```

### Colección: `audit_logs`

```js
{
  _id: ObjectId,
  entity: "user" | "contact" | "company" | "lead" | "deal",
  entity_id: "uuid-string",
  action: "created" | "updated" | "deleted" | "status_changed" | "assigned",
  before: Object,                   // estado anterior (null en create)
  after: Object,                    // estado nuevo (null en delete)
  performed_by: "uuid-string",
  ip_address: String,
  user_agent: String,
  timestamp: Date
}
```

**Índices recomendados:**
```js
{ entity: 1, entity_id: 1 }
{ performed_by: 1 }
{ timestamp: -1 }
```

---

## Estructura del Proyecto (Monorepo)

```
crm-project/
├── .gitignore
├── .env.example
├── ARQUITECTURA.md
├── frontend/
├── backend/
└── microservice/
```

### Frontend `frontend/src/`
```
├── assets/
├── components/
│   ├── ui/            # Button, Input, Modal, Table, Badge
│   ├── layout/        # Sidebar, TopNav, PageWrapper
│   └── forms/
├── features/
│   ├── auth/          # LoginPage, hooks, auth.api.ts
│   ├── contacts/
│   ├── leads/         # LeadKanban (vista tipo Trello)
│   ├── deals/
│   ├── activities/    # Timeline de actividades por entidad
│   └── reports/       # Recharts + datos de FastAPI vía Node
├── hooks/             # useDebounce, usePagination
├── lib/
│   ├── axios.ts       # instancia con interceptores de token
│   └── queryClient.ts
├── store/
│   └── authStore.ts   # Zustand: user en memoria
├── types/
├── utils/
└── router/
    ├── index.tsx
    └── ProtectedRoute.tsx
```

### Backend `backend/src/`
```
├── config/
│   ├── env.ts              # valida env vars con Zod
│   ├── postgres.ts         # Prisma client singleton
│   ├── mongodb.ts          # Mongoose connection singleton
│   └── logger.ts           # pino
├── middleware/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   ├── validate.middleware.ts
│   └── rateLimit.middleware.ts
├── modules/
│   ├── auth/               # routes → controller → service → schema
│   ├── users/
│   ├── contacts/
│   ├── companies/
│   ├── leads/
│   ├── deals/
│   ├── activities/         # usa MongoDB vía Mongoose
│   ├── audit/              # audit_log middleware + routes de consulta
│   └── reports/            # proxy a FastAPI
├── models/                 # Mongoose models (MongoDB)
│   ├── Activity.model.ts
│   └── AuditLog.model.ts
├── types/
│   └── express.d.ts
└── utils/
    ├── jwt.utils.ts
    ├── hash.utils.ts
    ├── response.utils.ts
    └── microservice.client.ts
```

### Microservice `microservice/app/`
```
├── main.py
├── config.py
├── database.py             # SQLAlchemy (PostgreSQL)
├── mongodb.py              # Motor client (MongoDB) — para reportes de actividad
├── dependencies.py
├── auth/
│   └── jwt_validator.py
├── routers/
│   ├── reports.py          # pipeline (PG) + actividad (MongoDB)
│   ├── leads_ai.py         # /ai/score-lead
│   └── health.py
├── schemas/
├── services/
│   ├── pipeline_service.py     # queries PG
│   ├── conversion_service.py   # queries PG
│   ├── activity_service.py     # queries MongoDB (motor)
│   └── ai_service.py           # Claude API
└── models/
```

---

## Autenticación JWT

**Patrón: Access Token en memoria + Refresh Token en httpOnly cookie.**

```
Login
  ├─→ Node.js verifica email/password con bcryptjs
  ├─→ Genera Access Token JWT (15 min, HS256)
  ├─→ Genera Refresh Token (string random, hashed en DB PostgreSQL, 7 días)
  ├─→ Respuesta JSON: { accessToken, user }
  └─→ Set-Cookie: refreshToken=...; HttpOnly; SameSite=Lax; Path=/api/auth/refresh

React: accessToken en Zustand (memoria, NO localStorage)
Axios interceptor → Authorization: Bearer <token>
Axios interceptor en 401 → llama /api/auth/refresh automáticamente
FastAPI valida el mismo JWT (python-jose + JWT_SECRET compartido)
```

---

## Comunicación entre Servicios

```
React (:5173)
    │  HTTP + Authorization: Bearer <accessToken>
    ▼
Node.js Express (:4000)
    │  PostgreSQL via Prisma
    │  MongoDB via Mongoose
    │
    │  HTTP interno (reenvía JWT del usuario)
    ▼
FastAPI (:8000)
    │  PostgreSQL via SQLAlchemy async
    │  MongoDB via Motor async
    ▼
PostgreSQL (:5432) + MongoDB (:27017)
```

- React nunca llama directamente a FastAPI.
- Node audita automáticamente los cambios con un middleware que escribe en `audit_logs`.
- FastAPI lee de ambas DBs para generar reportes completos.

---

## Variables de Entorno

### `backend/.env`
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://crm_user:crm_password_2024@localhost:5432/crm_db
MONGODB_URI=mongodb://localhost:27017/crm_db
JWT_SECRET=<string_aleatorio_64+_chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FASTAPI_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:5173
```

### `microservice/.env`
```
APP_ENV=development
PORT=8000
DATABASE_URL=postgresql+asyncpg://crm_user:crm_password_2024@localhost:5432/crm_db
MONGODB_URI=mongodb://localhost:27017/crm_db
JWT_SECRET=<EXACTAMENTE_IGUAL_que_backend>
JWT_ALGORITHM=HS256
ANTHROPIC_API_KEY=sk-ant-...
```

### `frontend/.env`
```
VITE_API_URL=http://localhost:4000/api
```

---

## Dependencias por Capa

### Frontend
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom @tanstack/react-query axios zustand \
  react-hook-form zod @hookform/resolvers recharts date-fns \
  react-hot-toast lucide-react
npm install -D tailwindcss @tailwindcss/vite prettier eslint \
  @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Backend
```bash
npm install express @prisma/client mongoose zod jsonwebtoken bcryptjs \
  cookie-parser cors helmet express-rate-limit pino pino-pretty axios dotenv
npm install -D prisma typescript ts-node-dev \
  @types/express @types/node @types/jsonwebtoken @types/bcryptjs \
  @types/cookie-parser @types/cors @types/mongoose
```

> **Nota bcryptjs:** Usar `bcryptjs` (NO `bcrypt`). bcrypt requiere compilación
> nativa en Windows (node-gyp) y falla frecuentemente. bcryptjs es pure JS.

### Microservice
```bash
python -m venv venv
venv\Scripts\activate
pip install fastapi "uvicorn[standard]" pydantic pydantic-settings \
  sqlalchemy asyncpg "python-jose[cryptography]" motor \
  httpx anthropic python-dotenv
pip freeze > requirements.txt
```

> **motor** es el driver oficial async de MongoDB para Python (mismo equipo que pymongo).

---

## Orden de Implementación

### Fase 1 — Infraestructura ✅
1. `git init` + `.gitignore` + conectar a GitHub
2. Crear DB PostgreSQL: `CREATE DATABASE crm_db;` + usuario `crm_user`
3. Verificar MongoDB corriendo en `:27017`

### Fase 2 — Backend (Node.js)
4. `cd backend && npm init -y` + instalar dependencias
5. Configurar `tsconfig.json`
6. `npx prisma init` → escribir schema → `prisma migrate dev --name init`
7. Conectar MongoDB en `src/config/mongodb.ts` (Mongoose)
8. Crear Mongoose models: `Activity.model.ts`, `AuditLog.model.ts`
9. Implementar `jwt.utils.ts` + `hash.utils.ts`
10. Implementar módulo `auth` → **probar con REST Client antes de continuar**
11. Implementar CRUD: users → contacts → companies → leads → deals
12. Implementar módulo `activities` (escribe/lee en MongoDB)
13. Implementar audit middleware (intercepta saves y escribe en MongoDB)
14. Implementar módulo `reports` (proxy a FastAPI)

### Fase 3 — Microservice (FastAPI)
15. `cd microservice` → crear venv → instalar dependencias
16. Implementar `jwt_validator.py`
17. Conectar PostgreSQL (SQLAlchemy) + MongoDB (Motor)
18. Implementar reportes de pipeline (PostgreSQL)
19. Implementar reportes de actividad (MongoDB)
20. Implementar `ai_service.py` con Claude API

### Fase 4 — Frontend (React)
21. Scaffold Vite + instalar dependencias + configurar Tailwind
22. `axios.ts` con interceptores (token + refresh automático)
23. `authStore.ts` (Zustand) + LoginPage + ProtectedRoute
24. Features: contacts → leads (Kanban) → deals → activities (timeline) → reports

### Fase 5 — Integración y Pruebas
25. Correr los 3 servicios en paralelo (3 terminales)
26. Flujo E2E completo: Register → Login → Crear contacto → Lead → Deal → Actividad → Reporte

---

## Archivos Críticos (implementar primero)

| Archivo | Por qué es crítico |
|---|---|
| `backend/prisma/schema.prisma` | Define toda la estructura relacional |
| `backend/src/config/mongodb.ts` | Conexión MongoDB compartida en toda la app |
| `backend/src/models/Activity.model.ts` | Schema Mongoose de actividades |
| `backend/src/utils/jwt.utils.ts` | Base de toda la autenticación |
| `backend/src/modules/auth/auth.service.ts` | Login/refresh/logout |
| `frontend/src/lib/axios.ts` | Interceptores de token (si falla, nada funciona) |
| `microservice/app/auth/jwt_validator.py` | Seguridad del microservicio |
| `microservice/app/mongodb.py` | Conexión Motor async para reportes |

---

## Verificación Final

Levantar los 3 servicios (3 terminales separadas):
```powershell
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Microservicio
cd microservice && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Checklist:
- [ ] Register → Login → tokens correctos
- [ ] Refresh automático en token expirado
- [ ] Logout limpia cookie + Zustand
- [ ] CRUD contactos, leads, deals en PostgreSQL
- [ ] Crear actividad → aparece en MongoDB
- [ ] Audit log se registra automáticamente en MongoDB
- [ ] Reporte de pipeline carga desde FastAPI (PostgreSQL)
- [ ] Reporte de actividad carga desde FastAPI (MongoDB)
- [ ] Lead scoring responde con Claude AI
