import os
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from datetime import datetime
from itertools import combinations
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
SETS_PER_GAME = 2

_pool = None

def _get_pool():
    global _pool
    if _pool is None:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            2, 8, DATABASE_URL, cursor_factory=RealDictCursor
        )
    return _pool

@contextmanager
def get_connection():
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def init_tables():
    with get_connection() as conn:
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
                    end_time TIMESTAMP,
                    pool VARCHAR(1),
                    scheduled BOOLEAN DEFAULT FALSE,
                    working_team VARCHAR(255)
                );
            """)
            cur.execute("""
                ALTER TABLE games ADD COLUMN IF NOT EXISTS pool VARCHAR(1);
            """)
            cur.execute("""
                ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled BOOLEAN DEFAULT FALSE;
            """)
            cur.execute("""
                ALTER TABLE games ADD COLUMN IF NOT EXISTS working_team VARCHAR(255);
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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tournament_settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)
            cur.execute("""
                INSERT INTO tournament_settings (key, value)
                VALUES ('phase', 'pool_play')
                ON CONFLICT (key) DO NOTHING;
            """)
            conn.commit()


# ── Settings ─────────────────────────────────────────────────────

def get_setting(key: str) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM tournament_settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row["value"] if row else None


def set_setting(key: str, value: str):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tournament_settings (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, (key, value))
            conn.commit()


def get_all_settings() -> dict:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT key, value FROM tournament_settings")
            return {row["key"]: row["value"] for row in cur.fetchall()}


# ── Team operations ──────────────────────────────────────────────

def load_all_teams():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT team_name, player1, player2, pool FROM teams ORDER BY team_name")
            return {
                row["team_name"]: {
                    "player1": row["player1"],
                    "player2": row["player2"],
                    "pool": row["pool"],
                }
                for row in cur.fetchall()
            }


def save_team(team_name: str, player1: str, player2: str, pool: str):
    with get_connection() as conn:
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


def delete_team(team_name: str):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM teams WHERE team_name = %s", (team_name,))
            conn.commit()
            return cur.rowcount > 0


# ── Game operations ──────────────────────────────────────────────

def load_all_games():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT g.game_key, g.team1_name, g.team2_name, g.completed, g.winner,
                       g.start_time, g.end_time, g.pool, g.scheduled, g.working_team,
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
                        "pool": row["pool"],
                        "scheduled": row["scheduled"] or False,
                        "working_team": row["working_team"],
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


def save_game(game_key: str, game_data: dict):
    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO games (game_key, team1_name, team2_name, completed, winner,
                                       start_time, end_time, pool, scheduled, working_team)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                    game_data.get("pool"),
                    game_data.get("scheduled", False),
                    game_data.get("working_team"),
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
                            game_id, set_num,
                            game_data["sets"][sk]["team1_score"],
                            game_data["sets"][sk]["team2_score"],
                        ))
                conn.commit()
                return True
        except Exception:
            conn.rollback()
            return False


def _assign_working_teams(pool_teams: list, matchups: list) -> list:
    """
    Assign working teams to matchups.
    
    Strategy:
    - Distribute work evenly across all teams
    - Max 2 consecutive games per team
    - Prefer teams that just finished playing (rest while working)
    
    Args:
        pool_teams: List of team names in the pool
        matchups: List of (team1, team2) tuples
    
    Returns:
        List of (team1, team2, working_team) tuples
    """
    if len(pool_teams) < 3:
        # Can't assign working teams if there aren't enough teams
        return [(t1, t2, None) for t1, t2 in matchups]
    
    # Track work count and consecutive work streak for each team
    work_count = {team: 0 for team in pool_teams}
    consecutive_work = {team: 0 for team in pool_teams}
    last_played = {team: -999 for team in pool_teams}  # Track when team last played
    
    result = []
    
    for idx, (team1, team2) in enumerate(matchups):
        # Find eligible workers: teams not playing this game
        eligible = [t for t in pool_teams if t not in (team1, team2)]
        
        # Filter out teams that worked 2 games in a row
        eligible = [t for t in eligible if consecutive_work[t] < 2]
        
        if not eligible:
            # Reset consecutive counts if everyone is blocked
            for team in pool_teams:
                if team not in (team1, team2):
                    consecutive_work[team] = 0
            eligible = [t for t in pool_teams if t not in (team1, team2)]
        
        # Prefer teams that just finished playing (higher last_played index)
        # If tied, prefer teams with lower total work count
        worker = max(eligible, key=lambda t: (last_played[t], -work_count[t]))
        
        # Update tracking
        work_count[worker] += 1
        consecutive_work[worker] += 1
        
        # Reset consecutive work for teams not working this game
        for team in pool_teams:
            if team != worker:
                consecutive_work[team] = 0
        
        # Update last_played for teams in this game
        last_played[team1] = idx
        last_played[team2] = idx
        
        result.append((team1, team2, worker))
    
    return result


def generate_pool_schedule(teams: dict) -> list:
    """Generate round-robin schedule for each pool with working team assignments."""
    pools = {}
    for team_name, td in teams.items():
        pool = td.get("pool", "A")
        pools.setdefault(pool, []).append(team_name)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT game_key FROM games")
            existing_keys = {row["game_key"] for row in cur.fetchall()}

    created = []
    for pool, pool_teams in pools.items():
        # Generate all matchups
        matchups = list(combinations(sorted(pool_teams), 2))
        
        # Assign working teams
        matchups_with_workers = _assign_working_teams(pool_teams, matchups)
        
        for team1, team2, working_team in matchups_with_workers:
            game_key = f"pool_{pool}_{team1}_vs_{team2}"
            if game_key in existing_keys:
                continue
            game_data = {
                "team1": team1,
                "team2": team2,
                "pool": pool,
                "scheduled": True,
                "working_team": working_team,
                "sets": {
                    "set1": {"team1_score": 0, "team2_score": 0},
                    "set2": {"team1_score": 0, "team2_score": 0},
                },
                "completed": False,
                "winner": None,
                "start_time": datetime.now().isoformat(),
                "end_time": None,
            }
            if save_game(game_key, game_data):
                created.append(game_key)
    return created


# ── Admin operations ─────────────────────────────────────────────

def delete_games_only():
    """Delete all games and scores but keep teams and phase."""
    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM game_sets")
                cur.execute("DELETE FROM games")
                conn.commit()
                return True
        except Exception:
            conn.rollback()
            return False


def delete_all_data():
    with get_connection() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM game_sets")
                cur.execute("DELETE FROM games")
                cur.execute("DELETE FROM teams")
                cur.execute("UPDATE tournament_settings SET value = 'pool_play' WHERE key = 'phase'")
                conn.commit()
                return True
        except Exception:
            conn.rollback()
            return False


# ── Standings calculation ────────────────────────────────────────

def calculate_standings(teams: dict, games: dict):
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

    return sorted(
        standings.values(),
        key=lambda x: (x["set_wins"], x["point_differential"]),
        reverse=True,
    )