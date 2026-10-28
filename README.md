<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Transport Scheduling and Ticket Booking System

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/afbe0160-aadb-4d32-a246-9f1f5eb4a95b

## Web dashboard

The Next.js dashboard provides JWT-authenticated workspaces for System Admins,
Association Managers, and Terminal Clerks. It uses the existing Spring Boot API
for sign-in and role verification.

1. Install dependencies: `npm install`
2. Start the Spring Boot API by following [backend/README.md](backend/README.md).
3. Optionally set `TRANSPORT_API_URL` to the API base URL (defaults to
   `http://localhost:8080`).
4. Start the dashboard: `npm run dev`
5. Open `http://localhost:3000` and sign in with a backend account.

The JWT is stored in an HttpOnly, SameSite cookie. The dashboard checks the
token against the backend profile endpoint and only renders administrative,
manager, or clerk workspaces. Current operations screens still use the
browser-local prototype state; they are not persisted to backend records.

The original Vite app remains available with `npm run dev:vite`. Its production
build can be run with `npm run build:vite`.

## Passenger mobile app

The Flutter passenger app is in [mobile/](mobile/README.md). It supports
passenger registration/sign-in, trip filtering, seat holds, demo Telebirr/CBE
Birr checkout, and secure offline ticket QR storage. Enable the backend's
`MOCK_PAYMENT_ENABLED` setting only for demo/test deployments.

## Backend API

The Spring Boot authentication and RBAC API is in [backend/README.md](backend/README.md).
It runs separately from the Vite frontend and connects to the PostgreSQL schema
used by the transport system.
