import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "")

SETS_PER_GAME = 2


def get_connection():
    """Get a new database connection."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn


def init_tables():
    """Create tables if they don't exist."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS teams (
                    id SERIAL PRIMARY KEY,
                    team_name VARCHAR(255) UNIQUE NOT NULL,
                    player1 VARCHAR(255) DEFAULT '',
                    player2 VARCHAR(255) DEFAULT '',
                    pool VARCHAR(1) NOT NULL DEFAULT 'A'
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    game_key VARCHAR(512) UNIQUE NOT NULL,
                    team1_name VARCHAR(255) NOT NULL,
                    team2_name VARCHAR(255) NOT NULL,
                    completed BOOLEAN DEFAULT FALSE,
                    winner VARCHAR(255),
                    start_time TIMESTAMP,
                    end_time TIMESTAMP
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS game_sets (
                    id SERIAL PRIMARY KEY,
                    game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
                    set_number INTEGER NOT NULL,
                    team1_score INTEGER DEFAULT 0,
                    team2_score INTEGER DEFAULT 0,
                    UNIQUE(game_id, set_number)
                );
            """)
            conn.commit()
    finally:
        conn.close()


# ── Team operations ──────────────────────────────────────────────

def load_all_teams():
    """Return dict of all teams keyed by team_name."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT team_name, player1, player2, pool FROM teams ORDER BY team_name")
            rows = cur.fetchall()
            teams = {}
            for row in rows:
                teams[row["team_name"]] = {
                    "player1": row["player1"],
                    "player2": row["player2"],
                    "pool": row["pool"],
                }
            return teams
    finally:
        conn.close()


def save_team(team_name: str, player1: str, player2: str, pool: str):
    """Insert a new team. Returns True on success."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO teams (team_name, player1, player2, pool) VALUES (%s, %s, %s, %s)",
                (team_name, player1, player2, pool),
            )
            conn.commit()
            return True
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return False
    finally:
        conn.close()


def delete_team(team_name: str):
    """Delete a team by name."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM teams WHERE team_name = %s", (team_name,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        conn.close()


# ── Game operations ──────────────────────────────────────────────

def load_all_games():
    """Return dict of all games keyed by game_key, with nested set scores."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT g.game_key, g.team1_name, g.team2_name, g.completed, g.winner,
                       g.start_time, g.end_time,
                       gs.set_number, gs.team1_score, gs.team2_score
                FROM games g
                LEFT JOIN game_sets gs ON g.id = gs.game_id
                ORDER BY g.id, gs.set_number
            """)
            rows = cur.fetchall()

            games = {}
            for row in rows:
                gk = row["game_key"]
                if gk not in games:
                    games[gk] = {
                        "team1": row["team1_name"],
                        "team2": row["team2_name"],
                        "completed": row["completed"],
                        "winner": row["winner"],
                        "start_time": row["start_time"].isoformat() if row["start_time"] else None,
                        "end_time": row["end_time"].isoformat() if row["end_time"] else None,
                        "sets": {
                            "set1": {"team1_score": 0, "team2_score": 0},
                            "set2": {"team1_score": 0, "team2_score": 0},
                        },
                    }
                if row["set_number"]:
                    sk = f"set{row['set_number']}"
                    games[gk]["sets"][sk] = {
                        "team1_score": row["team1_score"] or 0,
                        "team2_score": row["team2_score"] or 0,
                    }
            return games
    finally:
        conn.close()


def save_game(game_key: str, game_data: dict):
    """Upsert a game and its set scores."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO games (game_key, team1_name, team2_name, completed, winner, start_time, end_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_key)
                DO UPDATE SET
                    completed = EXCLUDED.completed,
                    winner    = EXCLUDED.winner,
                    end_time  = EXCLUDED.end_time
                RETURNING id
            """, (
                game_key,
                game_data["team1"],
                game_data["team2"],
                game_data.get("completed", False),
                game_data.get("winner"),
                datetime.fromisoformat(game_data["start_time"]) if game_data.get("start_time") else None,
                datetime.fromisoformat(game_data["end_time"]) if game_data.get("end_time") else None,
            ))
            game_id = cur.fetchone()["id"]

            for set_num in range(1, SETS_PER_GAME + 1):
                sk = f"set{set_num}"
                if sk in game_data.get("sets", {}):
                    cur.execute("""
                        INSERT INTO game_sets (game_id, set_number, team1_score, team2_score)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (game_id, set_number)
                        DO UPDATE SET
                            team1_score = EXCLUDED.team1_score,
                            team2_score = EXCLUDED.team2_score
                    """, (
                        game_id,
                        set_num,
                        game_data["sets"][sk]["team1_score"],
                        game_data["sets"][sk]["team2_score"],
                    ))
            conn.commit()
            return True
    except Exception:
        conn.rollback()
        return False
    finally:
        conn.close()


# ── Admin operations ─────────────────────────────────────────────

def delete_all_data():
    """Wipe all tournament data (teams + games + sets)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM game_sets")
            cur.execute("DELETE FROM games")
            cur.execute("DELETE FROM teams")
            conn.commit()
            return True
    except Exception:
        conn.rollback()
        return False
    finally:
        conn.close()


# ── Standings calculation ────────────────────────────────────────

def calculate_standings(teams: dict, games: dict):
    """
    Pure function: compute standings from teams + games dicts.
    Returns list of dicts sorted by set_wins desc, point_differential desc.
    """
    standings = {}
    for team_name, td in teams.items():
        standings[team_name] = {
            "team": team_name,
            "pool": td.get("pool", "A"),
            "games_played": 0,
            "set_wins": 0,
            "set_losses": 0,
            "points_for": 0,
            "points_against": 0,
            "point_differential": 0,
        }

    for gd in games.values():
        if not gd.get("completed"):
            continue
        t1, t2 = gd["team1"], gd["team2"]
        if t1 not in standings or t2 not in standings:
            continue

        standings[t1]["games_played"] += 1
        standings[t2]["games_played"] += 1

        for sn in range(1, SETS_PER_GAME + 1):
            sk = f"set{sn}"
            s1 = gd["sets"][sk]["team1_score"]
            s2 = gd["sets"][sk]["team2_score"]

            standings[t1]["points_for"] += s1
            standings[t1]["points_against"] += s2
            standings[t2]["points_for"] += s2
            standings[t2]["points_against"] += s1

            if s1 > s2:
                standings[t1]["set_wins"] += 1
                standings[t2]["set_losses"] += 1
            elif s2 > s1:
                standings[t2]["set_wins"] += 1
                standings[t1]["set_losses"] += 1

        standings[t1]["point_differential"] = standings[t1]["points_for"] - standings[t1]["points_against"]
        standings[t2]["point_differential"] = standings[t2]["points_for"] - standings[t2]["points_against"]

    result = sorted(
        standings.values(),
        key=lambda x: (x["set_wins"], x["point_differential"]),
        reverse=True,
    )
    return result