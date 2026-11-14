# Thniyti (Phase 1)

Thniyti is a student carpooling platform project.

This Phase 1 setup includes:
- `frontend/`: Angular (standalone + router)
- `backend/`: Node.js + Express + TypeScript REST API skeleton

## Why this stack
- **Angular** for a structured frontend with routing and reusable components.
- **Node.js + Express + TypeScript** for a simple, typed REST backend.
- **SQLite + Prisma** will be added in Phase 2 for a SQL database that runs from a single file.

## Project structure
```text
thniyti/
  frontend/
  backend/
  README.md
```

## Run from a fresh clone

### 1) Frontend
```bash
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:4200`.

### 2) Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3000`.

Health endpoint:
- `GET http://localhost:3000/api/health`

Build backend for production:
```bash
cd backend
npm run build
npm start
```

## AI usage
This project is developed with AI pair-programming support (GitHub Copilot / Claude) for:
- scaffolding,
- code review assistance,
- and documentation drafting.

All generated code is reviewed and adjusted by the team.
