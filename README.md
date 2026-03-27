<<<<<<< HEAD
# Cohold

Monorepo for the Cohold fractional real estate investment platform.

## Structure

- **`backend/`** – NestJS API (PostgreSQL, Redis, BullMQ, Paystack, WebSockets). See [backend/README.md](backend/README.md).
- **`frontend/`** – Next.js app (investor + admin UIs). See [frontend/README.md](frontend/README.md) if present.

Backend and frontend are fully separate: own `package.json`, `node_modules`, `tsconfig`, and env. No cross-imports.

## Quick start (local, no Docker)

1. **PostgreSQL on Windows** – Install PostgreSQL and create the database:
   ```bash
   # In psql or pgAdmin: CREATE DATABASE cohold;
   # Or from shell: psql -U postgres -c "CREATE DATABASE cohold;"
   ```

2. **Backend** – Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cohold` (replace `YOUR_PASSWORD` with your postgres user password). Then:
   ```bash
   npm run install:all
   cd backend && npx prisma migrate dev
   cd .. && npm run dev:backend
   ```

3. **Frontend** (separate terminal):
   ```bash
   npm run dev:frontend
   ```

Backend runs at **http://localhost:4000** (API at `/api/v1`, docs at `/docs`). Redis is currently disabled; no Docker required.

## Docker (full stack)

Runs Postgres, Redis, backend API, and Next.js frontend.

1. **Backend env** – Ensure `backend/.env` exists (copy from `backend/.env.example`) and has real or dev values. `DATABASE_URL` and `REDIS_URL` are overridden in Compose to use `postgres` and `redis` hosts.

2. **First run** – Apply DB migrations (one-off, or whenever schema changes):
   ```bash
   cd backend && npx prisma migrate deploy
   ```
   Or run the API once and migrate from another terminal:
   ```bash
   docker compose run --rm api npx prisma migrate deploy
   ```

3. **Start stack**:
   ```bash
   docker compose up --build
   ```

- **Frontend:** http://localhost:3000  
- **API:** http://localhost:4000/api/v1  
- **API docs:** http://localhost:4000/docs  

Frontend build args (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`) are set in `docker-compose.yml` for local use. Override in the `frontend` service `build.args` for production.
=======
# Cohold
>>>>>>> 62ed5e6728c64016634480496131d4270ad27912
