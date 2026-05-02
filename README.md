# KIJ Grass Volleyball Tournament – Score Tracker

A real-time volleyball tournament management app built with FastAPI backend and React (Vite) frontend. Designed for phone-first, multi-device use by players and tournament admins.

## Features

| Feature | Details |
|---------|---------|
| **Team Management** | Register teams across Pools A / B / C / D / E |
| **Smart Game Interface** | Card-based layout showing "Currently Playing" and "Up Next" - no scrolling through long dropdowns |
| **Working Team Assignment** | Auto-assigns referee teams when schedule is generated - distributes work evenly, max 2 consecutive games |
| **Live Game Scoring** | +1 / -1 buttons for each team per set (2 sets per game) |
| **Real-Time Updates** | WebSocket broadcasts every score change to all connected clients |
| **Live Scoreboard** | See active games and standings update instantly — no refresh needed |
| **Tournament Standings** | Ranked by set wins → point differential, organized by pool |
| **Collapsible Game Lists** | Completed games collapse by default to reduce clutter |
| **Admin System** | Login required to manage teams, generate schedules, switch phases, reset tournament |
| **Database Persistence** | PostgreSQL (Neon) — data survives server restarts |
| **Deployment** | Frontend on Vercel, Backend on Render with UptimeRobot cold-start mitigation |

## Project Structure

```
kij/
├── backend/
│   ├── main.py              # FastAPI app – REST API + WebSocket
│   ├── database.py          # PostgreSQL operations + working team algorithm
│   ├── requirements.txt     # Python dependencies
│   ├── render.yaml          # Render deployment config
│   └── .env                 # DATABASE_URL (not in git)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── TeamsPage.jsx       # Admin panel - team management
│   │   │   ├── GamesPage.jsx       # Smart card scoring interface
│   │   │   ├── LivePage.jsx        # Live standings
│   │   │   └── AdminLoginPage.jsx
│   │   ├── components/
│   │   │   ├── NavBar.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── Toast.jsx
│   │   ├── api/
│   │   │   ├── http.js             # HTTP client
│   │   │   └── websocket.js        # WebSocket manager
│   │   ├── styles/
│   │   │   ├── styles.css          # Global styles
│   │   │   ├── navigation.css
│   │   │   └── cards.css
│   │   ├── App.jsx                 # Root component
│   │   └── main.jsx                # Entry point
│   ├── public/
│   │   └── _redirects              # Vercel SPA routing
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
└── README.md
```

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Create a .env file with your Neon database URL
echo "DATABASE_URL=postgresql://user:password@host/dbname" > .env

# Install dependencies
pip install -r requirements.txt

# Run (tables auto-create on first start)
python main.py

# → API at http://localhost:8000
# → WebSocket at ws://localhost:8000/ws
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# → Open http://localhost:5173
```

**Important:** Update the API URL in `frontend/src/api/http.js` and `frontend/src/api/websocket.js` if your backend is not on localhost:8000.

## Deployment

### Backend (Render)
- Deploy from GitHub repo
- Set environment variable: `DATABASE_URL` (from Neon)
- Free tier has cold starts (~30s) - mitigated with UptimeRobot pinging every 5 minutes
- Live at: `kij-backend.onrender.com`

### Frontend (Vercel)
- Deploy from GitHub repo
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_API_URL` (backend URL)
- Live at: `kij-lime.vercel.app`

### UptimeRobot Setup
- Monitor type: HTTP(s)
- URL: `https://kij-backend.onrender.com/api/teams`
- Monitoring interval: 5 minutes
- This keeps the backend warm and reduces cold start delays

## Admin Login

**Username:** `admin`  
**Password:** `volleyball123`

Click **ADMIN** in the nav bar → log in → access team management, schedule generation, phase switching, and tournament reset.

**Security Note:** Change the password hash in `backend/main.py` (line 23) for production use.

## How Real-Time Works

1. Frontend opens WebSocket to `ws://backend/ws`
2. Backend sends initial state (teams + games + settings) on connect
3. Every REST mutation (score update, new team, game complete, reset) broadcasts updated state to all connected clients
4. React app receives broadcast and updates UI automatically — no polling, no page refresh

## Smart Scoring Interface

### Pool Play Flow
- Games auto-sort: incomplete first, completed last
- **Currently Playing** (first incomplete game) - highlighted with ⚡ icon
- **Up Next** (second incomplete game) - ready to score
- **Other games** collapsed under "X more games in queue"
- **Completed games** collapsed under "✓ Completed Games (X)"
- Each pool (A, B, C...) has its own section

### Working Team Assignment
- Automatically assigned when schedule is generated
- Algorithm ensures:
  - Even distribution across all teams in the pool
  - Max 2 consecutive games per team
  - Prefers teams that just finished playing (rest while working)
- Displayed on the scoring interface when you open a game

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Admin authentication |
| GET | `/api/settings` | Get all tournament settings |
| GET | `/api/settings/phase` | Get current phase (pool_play / playoffs) |
| POST | `/api/settings/phase` | Update tournament phase |
| GET | `/api/teams` | List all teams |
| POST | `/api/teams` | Register a new team |
| DELETE | `/api/teams/{name}` | Delete a team |
| GET | `/api/games` | List all games (includes working_team) |
| POST | `/api/games` | Create a manual game |
| POST | `/api/schedule/generate` | Generate round-robin schedule with working teams |
| POST | `/api/games/score` | Update a set score (+1 / -1) |
| POST | `/api/games/complete` | Mark game as complete, calculate winner |
| GET | `/api/standings` | Get calculated standings by pool |
| POST | `/api/admin/reset` | Delete all data (teams + games) |
| POST | `/api/admin/reset-games` | Delete games only (keep teams) |
| WS | `/ws` | Real-time WebSocket connection |

## Database Schema

### Teams Table
```sql
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(255) UNIQUE NOT NULL,
    player1 VARCHAR(255) DEFAULT '',
    player2 VARCHAR(255) DEFAULT '',
    pool VARCHAR(1) NOT NULL DEFAULT 'A'
);
```

### Games Table
```sql
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    game_key VARCHAR(512) UNIQUE NOT NULL,
    team1_name VARCHAR(255) NOT NULL,
    team2_name VARCHAR(255) NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    winner VARCHAR(255),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    pool VARCHAR(1),
    scheduled BOOLEAN DEFAULT FALSE,
    working_team VARCHAR(255)  -- Auto-assigned when schedule generated
);
```

### Game Sets Table
```sql
CREATE TABLE game_sets (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    team1_score INTEGER DEFAULT 0,
    team2_score INTEGER DEFAULT 0,
    UNIQUE(game_id, set_number)
);
```

### Tournament Settings Table
```sql
CREATE TABLE tournament_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
);
```

## Tech Stack

- **Backend:** Python 3.10+, FastAPI, Uvicorn, psycopg2, python-dotenv
- **Frontend:** React 18 (Vite), JavaScript (JSX)
- **Database:** PostgreSQL (Neon)
- **Real-Time:** WebSocket (native browser API + FastAPI WebSocket)
- **Deployment:** Vercel (frontend), Render (backend)
- **Monitoring:** UptimeRobot (backend cold-start mitigation)

## Development Notes

### Phone-First Design
- Minimum 48-60px touch targets for all buttons
- Responsive layout with media queries for mobile nav
- Optimistic UI updates for instant feedback
- WebSocket + local state for real-time scoring without lag

### Performance Optimizations
- WebSocket broadcasts reuse already-loaded game dict to avoid redundant DB reads
- Optimistic score updates with rollback on error
- "Finishing" state lock prevents race conditions during game completion
- Connection pooling (2-8 connections) for concurrent users

### Known Limitations
- Render free tier has ~30s cold starts (mitigated by UptimeRobot)
- Working team algorithm requires ≥3 teams per pool
- Team name edits planned for future admin panel update

## Future Improvements
- [ ] Admin panel: Edit team names (keeps scores intact)
- [ ] Court assignments for scheduling
- [ ] Time slots for games
- [ ] Playoff bracket visualization
- [ ] Export tournament results (CSV/PDF)

## License

MIT
