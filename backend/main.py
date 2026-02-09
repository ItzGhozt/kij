"""
KIJ Volleyball Tournament – FastAPI Backend
REST API + WebSocket for real-time score updates.
"""

import hashlib
import os
from datetime import datetime
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    init_tables,
    load_all_teams,
    save_team,
    delete_team,
    load_all_games,
    save_game,
    delete_all_data,
    calculate_standings,
)

# ── Config ───────────────────────────────────────────────────────
MAX_TEAMS = 15
SETS_PER_GAME = 2
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = hashlib.sha256("volleyball123".encode()).hexdigest()

# ── App setup ────────────────────────────────────────────────────
app = FastAPI(title="KIJ Volleyball Tournament API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ─────────────────────────────────────────────

class TeamCreate(BaseModel):
    team_name: str
    player1: str = ""
    player2: str = ""
    pool: str = "A"


class SetScore(BaseModel):
    team1_score: int = 0
    team2_score: int = 0


class GameCreate(BaseModel):
    team1: str
    team2: str


class ScoreUpdate(BaseModel):
    game_key: str
    set_key: str          # "set1" or "set2"
    team: str             # "team1" or "team2"
    delta: int            # +1 or -1


class CompleteGame(BaseModel):
    game_key: str


class AdminLogin(BaseModel):
    username: str
    password: str


# ── WebSocket manager ────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections and broadcasts updates."""

    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ── Startup ──────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    init_tables()


# ── Auth helper ──────────────────────────────────────────────────

def _verify(password: str) -> bool:
    return hashlib.sha256(password.encode()).hexdigest() == ADMIN_PASSWORD_HASH


# ── REST endpoints ───────────────────────────────────────────────

# --- Auth ---

@app.post("/api/auth/login")
def login(body: AdminLogin):
    if body.username == ADMIN_USERNAME and _verify(body.password):
        return {"success": True, "message": "Authenticated"}
    raise HTTPException(status_code=401, detail="Invalid credentials")


# --- Teams ---

@app.get("/api/teams")
def get_teams():
    return load_all_teams()


@app.post("/api/teams")
async def create_team(body: TeamCreate):
    teams = load_all_teams()
    if len(teams) >= MAX_TEAMS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_TEAMS} teams allowed")
    if body.team_name in teams:
        raise HTTPException(status_code=400, detail="Team name already exists")

    ok = save_team(body.team_name, body.player1, body.player2, body.pool)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save team")

    await manager.broadcast({"type": "teams_updated", "teams": load_all_teams()})
    return {"success": True, "team_name": body.team_name}


@app.delete("/api/teams/{team_name}")
async def remove_team(team_name: str):
    ok = delete_team(team_name)
    if not ok:
        raise HTTPException(status_code=404, detail="Team not found")
    await manager.broadcast({"type": "teams_updated", "teams": load_all_teams()})
    return {"success": True}


# --- Games ---

@app.get("/api/games")
def get_games():
    return load_all_games()


@app.post("/api/games")
async def create_game(body: GameCreate):
    game_key = f"{body.team1}_vs_{body.team2}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    game_data = {
        "team1": body.team1,
        "team2": body.team2,
        "sets": {
            "set1": {"team1_score": 0, "team2_score": 0},
            "set2": {"team1_score": 0, "team2_score": 0},
        },
        "completed": False,
        "winner": None,
        "start_time": datetime.now().isoformat(),
        "end_time": None,
    }
    save_game(game_key, game_data)
    await manager.broadcast({"type": "games_updated", "games": load_all_games()})
    return {"success": True, "game_key": game_key, "game": game_data}


@app.post("/api/games/score")
async def update_score(body: ScoreUpdate):
    games = load_all_games()
    if body.game_key not in games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = games[body.game_key]
    if game["completed"]:
        raise HTTPException(status_code=400, detail="Game already completed")

    score_field = f"{body.team}_score"
    current = game["sets"][body.set_key][score_field]
    new_val = max(0, current + body.delta)
    game["sets"][body.set_key][score_field] = new_val

    save_game(body.game_key, game)

    # Broadcast the live update
    all_games = load_all_games()
    await manager.broadcast({"type": "score_updated", "game_key": body.game_key, "games": all_games})
    return {"success": True, "game": all_games[body.game_key]}


@app.post("/api/games/complete")
async def complete_game(body: CompleteGame):
    games = load_all_games()
    if body.game_key not in games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = games[body.game_key]
    t1_sets, t2_sets = 0, 0
    for sn in range(1, SETS_PER_GAME + 1):
        sk = f"set{sn}"
        s1 = game["sets"][sk]["team1_score"]
        s2 = game["sets"][sk]["team2_score"]
        if s1 > s2:
            t1_sets += 1
        elif s2 > s1:
            t2_sets += 1

    if t1_sets > t2_sets:
        game["winner"] = game["team1"]
    elif t2_sets > t1_sets:
        game["winner"] = game["team2"]
    else:
        game["winner"] = "Split"

    game["completed"] = True
    game["end_time"] = datetime.now().isoformat()
    save_game(body.game_key, game)

    all_games = load_all_games()
    await manager.broadcast({"type": "game_completed", "games": all_games})
    return {"success": True, "winner": game["winner"]}


# --- Standings ---

@app.get("/api/standings")
def get_standings():
    teams = load_all_teams()
    games = load_all_games()
    return calculate_standings(teams, games)


# --- Admin reset ---

@app.post("/api/admin/reset")
async def reset_tournament():
    ok = delete_all_data()
    if not ok:
        raise HTTPException(status_code=500, detail="Reset failed")
    await manager.broadcast({"type": "tournament_reset"})
    return {"success": True}


# ── WebSocket endpoint ───────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send initial state
        await ws.send_json({
            "type": "init",
            "teams": load_all_teams(),
            "games": load_all_games(),
        })
        # Keep alive – listen for client pings
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(ws)


# ── Run ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)