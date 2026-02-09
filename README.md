# KIJ Grass Volleyball Tournament – Score Tracker

A real-time volleyball tournament management app, split into a **FastAPI backend** and a **React frontend** (plain `React.createElement`, no JSX).

---

## Features

| Feature | Details |
|---|---|
| **Team Management** | Register up to 15 teams across Pools A / B / C |
| **Live Game Scoring** | +1 / -1 buttons for each team per set (2 sets per game) |
| **Real-Time Updates** | WebSocket broadcasts every score change to all connected clients |
| **Live Scoreboard** | See active games and standings update instantly — no refresh needed |
| **Tournament Standings** | Ranked by set wins → point differential |
| **Game History** | Expandable list grouped by Pool A / B / C / Inter-Pool |
| **Admin System** | Login required to register teams, delete teams, or reset tournament |
| **Database Persistence** | PostgreSQL (Neon) — data survives server restarts |

---

## Project Structure

```
volleyball-tournament/
├── backend/
│   ├── main.py              # FastAPI app – REST API + WebSocket
│   ├── database.py          # All PostgreSQL operations
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Template for DATABASE_URL
├── frontend/
│   ├── index.html           # Entry point – loads React from CDN
│   ├── css/
│   │   ├── styles.css       # Global styles, palette, typography, utilities
│   │   ├── navigation.css   # Sticky nav bar
│   │   └── cards.css        # Score cards, team cards, game history, standings table
│   └── js/
│       ├── api.js           # HTTP client + WebSocket connection manager
│       ├── components.js    # All React components (no JSX)
│       └── app.js           # Root component, routing, state, WS listener
└── README.md
```

---

## Quick Start

### 1. Backend

```bash
cd backend

# Create a .env file with your Neon database URL
cp .env.example .env
# Edit .env → set DATABASE_URL

# Install dependencies
pip install -r requirements.txt

# Run (tables auto-create on first start)
python main.py
# → API at http://localhost:8000
# → WebSocket at ws://localhost:8000/ws
```

### 2. Frontend

```bash
cd frontend

# Any static file server works:
python -m http.server 3000
# → Open http://localhost:3000
```

> **Note:** If you change the backend port or deploy to a remote server, update `BASE` and `WS_URL` at the top of `frontend/js/api.js`.

---

## Admin Login

- **Username:** `admin`
- **Password:** `volleyball123`

Click **ADMIN** in the nav bar → log in → you'll see team registration, delete buttons, and the tournament reset option.

---

## How Real-Time Works

1. Frontend opens a WebSocket to `ws://localhost:8000/ws`.
2. Backend sends initial state (`teams` + `games`) on connect.
3. Every REST mutation (score update, new team, game complete, reset) broadcasts the updated state to **all** connected WebSocket clients.
4. The React app receives the broadcast and updates state automatically — no polling, no page refresh.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin authentication |
| `GET` | `/api/teams` | List all teams |
| `POST` | `/api/teams` | Register a new team |
| `DELETE` | `/api/teams/{name}` | Delete a team |
| `GET` | `/api/games` | List all games |
| `POST` | `/api/games` | Start a new game |
| `POST` | `/api/games/score` | Update a set score (+1 / -1) |
| `POST` | `/api/games/complete` | Mark game as complete |
| `GET` | `/api/standings` | Get calculated standings |
| `POST` | `/api/admin/reset` | Wipe all data |
| `WS` | `/ws` | Real-time WebSocket |

---

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, psycopg2
- **Frontend:** React 18 (CDN), plain `React.createElement()` — no build step
- **Database:** PostgreSQL on [Neon](https://neon.tech)
- **Real-Time:** WebSocket (native browser API + FastAPI)