# Thniyti (Phase 2)

Thniyti is a student carpooling platform project.

This MVP includes:
- `frontend/`: Angular (standalone + router)
- `backend/`: Node.js + Express + TypeScript REST API with SQLite and Prisma
- Authentication, profiles, ride search/publishing, and seat bookings

## Why this stack
- **Angular** for a structured frontend with routing and reusable components.
- **Node.js + Express + TypeScript** for a simple, typed REST backend.
- **SQLite + Prisma** provide a SQL database that runs from a single file.

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
npx prisma migrate dev --name init
npm run dev
```
Backend runs on `http://localhost:3000`.

The database schema contains `User` and `Ride` models. Copy `.env.example` to
`.env` before running migrations if `DATABASE_URL` is not already configured.

The backend exposes:
- `POST /api/auth/register` and `POST /api/auth/login`
- `GET/PATCH /api/profile`
- `GET/POST/PATCH/DELETE /api/rides`
- `GET /api/bookings`, `POST /api/bookings/rides/:rideId`, and `PATCH /api/bookings/:id/cancel`

### 3) Use the MVP

Open `http://localhost:4200` to search rides, create an account, publish a
ride, book available seats, manage bookings, and update your profile.

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
