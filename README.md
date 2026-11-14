# Thniyti (Objectif 3)

Thniyti is a student carpooling platform project.

## Features

- Account registration and JWT login
- Ride search by origin, destination, and date
- Ride creation, editing, and deletion for drivers
- Seat-aware ride booking and booking cancellation
- Profile viewing and editing
- Responsive Angular interface for mobile, tablet, and desktop

## Framework and architecture

- `frontend/`: Angular (standalone + router)
- `backend/`: Node.js + Express + TypeScript REST API with SQLite and Prisma

Angular was chosen for structured routing and reusable standalone components.
The backend uses Express and TypeScript for a small typed REST API. Prisma with
SQLite provides a local SQL database that is easy to run for development.

## Dependencies

- Frontend: Angular, Angular Router, RxJS, TypeScript
- Backend: Node.js, Express, TypeScript, Prisma, SQLite, Zod, JSON Web Token,
  bcryptjs, and dotenv

## Project structure
```text
thniyti/
  frontend/
  backend/
  README.md
```

## Launch from a fresh clone

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
cp .env.example .env
# Set DATABASE_URL and a strong JWT_SECRET in .env
npx prisma migrate dev --name init
npm run dev
```
Backend runs on `http://localhost:3000`.

The database schema contains users, rides, and bookings. `JWT_SECRET` is
required when the backend starts.

The backend exposes:
- `POST /api/auth/register` and `POST /api/auth/login`
- `GET/PATCH /api/profile`
- `GET/POST/PATCH/DELETE /api/rides`
- `GET /api/bookings`, `POST /api/bookings/rides/:rideId`, and `PATCH /api/bookings/:id/cancel`

### 3) Use the application

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
