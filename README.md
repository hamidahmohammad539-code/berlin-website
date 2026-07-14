# BERLIN // TRANSMISSION — Backend

Express + MongoDB API that replaces every `localStorage` call in `script.js`
with a real, shared, persistent database — so chat, confessions, poems,
deliveries, the dino leaderboard, and "Let's Make Up" rooms work the same
for every visitor, not just on one browser.

## Endpoints

| Method | Path | Access |
|---|---|---|
| POST | /api/deliveries | public |
| GET  | /api/deliveries | admin |
| POST | /api/inbox | public |
| GET  | /api/inbox | admin |
| GET/POST | /api/confessions | public |
| POST | /api/confessions/delete | admin |
| GET  | /api/chat/name-check?name= | public |
| POST | /api/chat/name-register | public |
| GET/POST | /api/chat/messages | public |
| POST | /api/chat/messages/delete | admin |
| GET  | /api/dino/leaderboard | public |
| POST | /api/dino/score | public |
| GET/POST | /api/poems | public |
| POST | /api/poems/delete | admin |
| GET/POST | /api/reconcile/rooms | public |
| GET  | /api/reconcile/rooms/:id | public |
| GET/POST | /api/reconcile/rooms/:roomId/messages | public |
| POST | /api/admin/login | public (checks the password) |

Admin-only routes require header `x-admin-password: <password>`.

## Environment variables

- `MONGODB_URI` — your MongoDB Atlas connection string
- `ADMIN_PASSWORD` — the admin dashboard password (defaults to `saba2011@`)
- `PORT` — set automatically by Render

## Run locally

```
npm install
cp .env.example .env   # then edit .env with your real MONGODB_URI
npm start
```
