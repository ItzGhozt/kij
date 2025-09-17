import streamlit as st
import pandas as pd
import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import traceback
import hashlib

# Configuration
MAX_TEAMS = 15
SETS_PER_GAME = 2

# Admin credentials - In production, store these securely
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = hashlib.sha256("volleyball123".encode()).hexdigest()  # Default password: volleyball123

def hash_password(password):
    """Hash a password for storing."""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hashed):
    """Verify a password against its hash."""
    return hash_password(password) == hashed

def admin_login():
    """Display admin login form and handle authentication."""
    with st.form("admin_login_form"):
        col1, col2, col3 = st.columns([1, 2, 1])
        
        with col2:
            st.markdown("🔑 **Admin Login**")
            username = st.text_input("Username", placeholder="Enter admin username")
            password = st.text_input("Password", type="password", placeholder="Enter password")
            
            submitted = st.form_submit_button("🚀 Login", use_container_width=True)
            
            if submitted:
                if username == ADMIN_USERNAME and verify_password(password, ADMIN_PASSWORD_HASH):
                    st.session_state.admin_authenticated = True
                    st.session_state.admin_mode = True
                    st.success("✅ Admin login successful!")
                    st.rerun()
                else:
                    st.error("❌ Invalid username or password")

# Database connection
@st.cache_resource
def init_connection():
    """Initialize database connection"""
    try:
        # Try to get database URL from Streamlit secrets first, then environment variables
        database_url = None
        
        # Method 1: Try Streamlit secrets
        try:
            database_url = st.secrets["DATABASE_URL"]
        except:
            # Method 2: Try environment variables as fallback
            database_url = os.getenv("DATABASE_URL")
            if not database_url:
                st.error("DATABASE_URL not found in secrets or environment variables")
                return None
        
        # Try to connect
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        return conn
        
    except Exception as e:
        st.error(f"Database connection failed: {e}")
        st.error("Please check your DATABASE_URL in Streamlit Cloud secrets")
        return None

def get_db_connection():
    """Get database connection"""
    if 'db_conn' not in st.session_state:
        st.session_state.db_conn = init_connection()
    return st.session_state.db_conn

# Database operations
def load_teams_from_db():
    """Load teams from database"""
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT team_name, player1, player2, pool FROM teams ORDER BY team_name")
            rows = cur.fetchall()
            teams = {}
            for row in rows:
                teams[row['team_name']] = {
                    'player1': row['player1'],
                    'player2': row['player2'],
                    'pool': row['pool']
                }
            return teams
    except Exception as e:
        st.error(f"Error loading teams: {e}")
        return {}

def save_team_to_db(team_name, player1, player2, pool):
    """Save team to database"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO teams (team_name, player1, player2, pool) 
                VALUES (%s, %s, %s, %s)
            """, (team_name, player1, player2, pool))
            conn.commit()
            return True
    except Exception as e:
        st.error(f"Error saving team: {e}")
        conn.rollback()
        return False

def load_games_from_db():
    """Load games from database"""
    conn = get_db_connection()
    if not conn:
        return {}
    
    try:
        with conn.cursor() as cur:
            # Get games with their sets
            cur.execute("""
                SELECT g.*, 
                       gs.set_number, gs.team1_score, gs.team2_score
                FROM games g
                LEFT JOIN game_sets gs ON g.id = gs.game_id
                ORDER BY g.id, gs.set_number
            """)
            rows = cur.fetchall()
            
            games = {}
            for row in rows:
                game_key = row['game_key']
                
                # Initialize game if not exists
                if game_key not in games:
                    games[game_key] = {
                        'team1': row['team1_name'],
                        'team2': row['team2_name'],
                        'completed': row['completed'],
                        'winner': row['winner'],
                        'start_time': row['start_time'].isoformat() if row['start_time'] else None,
                        'end_time': row['end_time'].isoformat() if row['end_time'] else None,
                        'sets': {
                            'set1': {'team1_score': 0, 'team2_score': 0},
                            'set2': {'team1_score': 0, 'team2_score': 0}
                        }
                    }
                
                # Add set data if exists
                if row['set_number']:
                    set_key = f"set{row['set_number']}"
                    games[game_key]['sets'][set_key] = {
                        'team1_score': row['team1_score'] or 0,
                        'team2_score': row['team2_score'] or 0
                    }
            
            return games
    except Exception as e:
        st.error(f"Error loading games: {e}")
        return {}

def save_game_to_db(game_key, game_data):
    """Save game to database"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            # Insert or update game
            cur.execute("""
                INSERT INTO games (game_key, team1_name, team2_name, completed, winner, start_time, end_time)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_key) 
                DO UPDATE SET 
                    completed = EXCLUDED.completed,
                    winner = EXCLUDED.winner,
                    end_time = EXCLUDED.end_time
                RETURNING id
            """, (
                game_key,
                game_data['team1'],
                game_data['team2'],
                game_data.get('completed', False),
                game_data.get('winner'),
                datetime.fromisoformat(game_data['start_time']) if game_data.get('start_time') else None,
                datetime.fromisoformat(game_data['end_time']) if game_data.get('end_time') else None
            ))
            
            game_id = cur.fetchone()['id']
            
            # Update sets
            for set_num in range(1, SETS_PER_GAME + 1):
                set_key = f'set{set_num}'
                if set_key in game_data['sets']:
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
                        game_data['sets'][set_key]['team1_score'],
                        game_data['sets'][set_key]['team2_score']
                    ))
            
            conn.commit()
            return True
    except Exception as e:
        st.error(f"Error saving game: {e}")
        conn.rollback()
        return False

def delete_all_data():
    """Delete all tournament data"""
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM game_sets")
            cur.execute("DELETE FROM games")
            cur.execute("DELETE FROM teams")
            conn.commit()
            return True
    except Exception as e:
        st.error(f"Error deleting data: {e}")
        conn.rollback()
        return False

# Initialize session state with database data
def initialize_session_state():
    """Initialize session state with data from database"""
    if 'data_loaded' not in st.session_state:
        st.session_state.teams = load_teams_from_db()
        st.session_state.games = load_games_from_db()
        st.session_state.data_loaded = True
    
    if 'current_page' not in st.session_state:
        st.session_state.current_page = 'home'
    if 'admin_mode' not in st.session_state:
        st.session_state.admin_mode = False
    if 'admin_authenticated' not in st.session_state:
        st.session_state.admin_authenticated = False

# Custom CSS (keeping original styling)
def load_css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    @import url('https://use.typekit.net/YOUR_KIT_ID.css');
    
    .main > div {
        padding: 0 2rem;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .stApp {
        background: linear-gradient(135deg, #b8d4b0 0%, #d4c5a0 50%, #e8d5b7 100%);
        min-height: 100vh;
        padding-top: 0;
    }
    
    /* Reduce top spacing */
    .main .block-container {
        padding-top: 1rem;
    }
    
    /* Clean Navigation Bar - mobile responsive */
    .nav-container {
        background: transparent;
        padding: 0.3rem 0;
        display: flex;
        justify-content: center;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
        gap: 0.3rem;
        flex-wrap: wrap;
    }
    
    .nav-item {
        color: rgba(45, 90, 45, 0.8) !important;
        text-decoration: none !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        padding: 0.3rem 0.6rem !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: all 0.3s ease !important;
        border-radius: 0 !important;
        white-space: nowrap;
    }
    
    .nav-item:hover {
        background: transparent !important;
        color: rgba(45, 90, 45, 1) !important;
        transform: none !important;
    }
    
    @media (max-width: 768px) {
        .nav-container {
            gap: 0.2rem;
            padding: 0.3rem 0;
        }
        
        .nav-item {
            font-size: 0.8rem !important;
            padding: 0.3rem 0.6rem !important;
        }
        
        .hero-title {
            font-size: 2.5rem !important;
        }
        
        .main > div {
            padding: 0 1rem;
        }
    }
    
    /* Hero section */
    .hero-section {
        background: linear-gradient(135deg, #b8d4b0 0%, #d4c5a0 50%, #e8d5b7 100%);
        height: calc(100vh - 60px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 1rem;
        position: relative;
        overflow: hidden;
    }
    
    .hero-title {
        font-family: 'foundation-sans', sans-serif;
        font-size: 3.2rem;
        font-weight: 700;
        color: #2d5a2d;
        margin-bottom: 0.5rem;
        text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.3);
        z-index: 10;
        position: relative;
        text-transform: uppercase;
        letter-spacing: 2px;
    }
    
    .hero-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 1rem;
        color: #4a6b4a;
        margin-bottom: 1.5rem;
        z-index: 10;
        position: relative;
        font-weight: 400;
        letter-spacing: 1px;
    }
    
    .card {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 1rem;
        padding: 2rem;
        margin: 1rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .score-card {
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        border-radius: 0.8rem;
        padding: 1.5rem;
        margin: 0.5rem 0;
        border-left: 4px solid #A4B87C;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }
    
    .team-name {
        font-size: 1.3rem;
        font-weight: 600;
        color: #2d3436;
        margin-bottom: 0.5rem;
    }
    
    .score-display {
        font-size: 2rem;
        font-weight: 700;
        color: #8B9F6B;
        text-align: center;
        margin: 0.5rem 0;
    }
    
    .vs-text {
        font-size: 1.5rem;
        font-weight: 500;
        color: #636e72;
        text-align: center;
        margin: 1rem 0;
    }
    
    /* White dataframe styling */
    .stDataFrame {
        background-color: white !important;
    }
    
    .stDataFrame > div {
        background-color: white !important;
    }
    
    /* Hide Streamlit elements */
    .stDeployButton {display:none;}
    .stDecoration {display:none;}
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Custom button styles */
    div.stButton > button {
        background: transparent !important;
        color: rgba(45, 90, 45, 0.8) !important;
        border: none !important;
        padding: 0.5rem 1rem !important;
        font: inherit !important;
        cursor: pointer !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        font-weight: 500 !important;
        transition: all 0.3s ease !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        outline: none !important;
    }
    
    div.stButton > button:hover {
        background: transparent !important;
        color: rgba(45, 90, 45, 1) !important;
        border: none !important;
        box-shadow: none !important;
        transform: none !important;
        outline: none !important;
    }
    
    /* White text inputs with color palette consistency */
    .stTextInput > div > div > input {
        background-color: rgba(255, 255, 255, 0.95) !important;
        color: #2d3436 !important;
        border: 1px solid rgba(164, 184, 124, 0.3) !important;
        border-radius: 0.5rem !important;
    }
    
    .stSelectbox > div > div > div {
        background-color: rgba(255, 255, 255, 0.95) !important;
        color: #2d3436 !important;
        border: 1px solid rgba(164, 184, 124, 0.3) !important;
        border-radius: 0.5rem !important;
    }
    
    /* Primary button styling - smaller score button */
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #A4B87C, #8B9F6B) !important;
        color: white !important;
        border: none !important;
        border-radius: 0.5rem !important;
        padding: 0.6rem 1.2rem !important;
        font-weight: 600 !important;
        font-size: 1rem !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 15px rgba(164, 184, 124, 0.3) !important;
        text-transform: none !important;
        letter-spacing: normal !important;
    }
    
    .stButton > button[kind="primary"]:hover {
        background: linear-gradient(135deg, #8B9F6B, #7A8E5A) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px rgba(164, 184, 124, 0.5) !important;
    }
    
    /* Form submit buttons */
    .stForm button {
        background: linear-gradient(135deg, #BCA888, #D4C5A0) !important;
        color: white !important;
        border: none !important;
        border-radius: 0.5rem !important;
        padding: 0.75rem 1.5rem !important;
        font-weight: 600 !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 15px rgba(188, 168, 136, 0.3) !important;
    }
    
    .stForm button:hover {
        background: linear-gradient(135deg, #D4C5A0, #E8D5B7) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px rgba(188, 168, 136, 0.5) !important;
    }
    
    /* Admin logout button styling */
    .admin-logout-btn {
        position: fixed;
        top: 60px;
        right: 10px;
        z-index: 1000;
        background: rgba(220, 53, 69, 0.9) !important;
        color: white !important;
        border: none !important;
        border-radius: 20px !important;
        padding: 0.4rem 1rem !important;
        font-size: 0.8rem !important;
        backdrop-filter: blur(10px);
        transition: all 0.3s ease !important;
    }
    
    .admin-logout-btn:hover {
        background: rgba(220, 53, 69, 1) !important;
        transform: translateY(-1px) !important;
    }
    </style>
    """, unsafe_allow_html=True)

def navigation():
    # Admin login/logout logic
    if st.session_state.admin_mode and st.session_state.admin_authenticated:
        admin_text = "LOGOUT"
    elif st.session_state.admin_mode and not st.session_state.admin_authenticated:
        admin_text = "LOGIN"
    else:
        admin_text = "ADMIN"

    st.markdown('<div class="nav-container">', unsafe_allow_html=True)
    col1, col2, col3, col4, col5 = st.columns([1,1,1,1,1], gap="small")

    with col1:
        if st.button("HOME", key="nav_home"):
            st.session_state.current_page = "home"
            st.rerun()

    with col2:
        if st.button("TEAMS", key="nav_teams"):
            st.session_state.current_page = "teams"
            st.rerun()

    with col3:
        if st.button("GAMES", key="nav_games"):
            st.session_state.current_page = "games"
            st.rerun()

    with col4:
        if st.button("LIVE", key="nav_live"):
            st.session_state.current_page = "live"
            st.rerun()

    with col5:
        if st.button(admin_text, key="nav_admin"):
            if st.session_state.admin_mode and st.session_state.admin_authenticated:
                # Logout
                st.session_state.admin_mode = False
                st.session_state.admin_authenticated = False
                st.session_state.current_page = 'home'
                st.success("✅ Logged out successfully!")
                st.rerun()
            elif st.session_state.admin_mode and not st.session_state.admin_authenticated:
                # Already in login mode, do nothing or redirect to login
                pass
            else:
                # Switch to admin mode (will show login)
                st.session_state.admin_mode = True
                st.session_state.current_page = 'admin_login'
                st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)

def admin_login_page():
    """Display the admin login page."""
    st.title("Admin Portal")
    admin_login()

def home_page():
    st.markdown("""
    <div class="hero-section">
        <h1 class="hero-title">KIJ Volleyball Tournament</h1>
        <div style="margin-top: 3rem;">
            <div class="cta-text" style="color: #2d5a2d; font-size: 1.4rem; font-weight: 600; margin-bottom: 0.5rem;">Ready to Play?</div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Position button directly under "Ready to Play?" with minimal spacing
    col1, col2, col3 = st.columns([1, 3, 1])
    with col2:
        st.markdown('<div style="text-align: center; margin-top: -3.5rem; position: relative; z-index: 20;">', unsafe_allow_html=True)
        if st.button("🏐 Score a Game", type="primary", use_container_width=True):
            st.session_state.current_page = 'games'
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

def teams_page():
    st.title("Team Management")
    
    if st.session_state.admin_mode and st.session_state.admin_authenticated:
        st.subheader("📋 Admin View - All Teams")
        
        # Tournament Reset Feature - Admin Only
        with st.expander("⚠️ Tournament Reset", expanded=False):
            st.warning("This will delete ALL teams and games from the database. This action cannot be undone!")
            
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                if st.button("🗑️ Reset Tournament", key="reset_tournament"):
                    if 'show_reset_confirmation' not in st.session_state:
                        st.session_state.show_reset_confirmation = True
                        st.rerun()
            
            if st.session_state.get('show_reset_confirmation', False):
                st.error("⚠️ Are you absolutely sure you want to reset the entire tournament?")
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    if st.button("✅ Yes, Reset Everything", type="primary", key="confirm_reset"):
                        if delete_all_data():
                            st.session_state.teams = {}
                            st.session_state.games = {}
                            st.session_state.current_game_key = None
                            st.session_state.show_reset_confirmation = False
                            st.success("Tournament has been completely reset!")
                            st.balloons()
                            st.rerun()
                
                with col2:
                    if st.button("❌ Cancel", key="cancel_reset"):
                        st.session_state.show_reset_confirmation = False
                        st.rerun()
        
        # Team Registration - ONLY FOR ADMIN
        with st.expander("🆕 Register New Team", expanded=True):
            if len(st.session_state.teams) >= MAX_TEAMS:
                st.error(f"Maximum of {MAX_TEAMS} teams allowed!")
            else:
                with st.form("team_registration"):
                    team_name = st.text_input("Team Name", placeholder="Enter team name")
                    pool = st.selectbox("Pool Assignment", options=["A", "B", "C"])
                    
                    if st.form_submit_button("Register Team", type="primary"):
                        if team_name:
                            if team_name not in st.session_state.teams:
                                if save_team_to_db(team_name, "", "", pool):
                                    st.session_state.teams[team_name] = {
                                        'player1': "",
                                        'player2': "",
                                        'pool': pool
                                    }
                                    st.success(f"Team '{team_name}' registered successfully in Pool {pool}!")
                                    st.balloons()
                                    st.rerun()
                                else:
                                    st.error("Failed to save team to database!")
                            else:
                                st.error("Team name already exists!")
                        else:
                            st.error("Please enter a team name!")
    
    # Display teams (for both admin and players)
    if st.session_state.teams:
        st.subheader("Registered Teams by Pool")
        
        pools = {'A': [], 'B': [], 'C': []}
        for team_name, team_data in st.session_state.teams.items():
            pool = team_data.get('pool', 'A')
            pools[pool].append((team_name, team_data))
        
        for pool_name in ['A', 'B', 'C']:
            if pools[pool_name]:
                st.markdown(f"### 🏊 Pool {pool_name}")
                cols = st.columns(min(3, len(pools[pool_name])))
                
                for idx, (team_name, team_data) in enumerate(pools[pool_name]):
                    with cols[idx % 3]:
                        st.markdown(f"""
                        <div class="score-card">
                            <div class="team-name">🏐 {team_name}</div>
                            <div style="color: #8B9F6B; font-weight: 600; margin-top: 0.5rem;">Pool {pool_name}</div>
                        </div>
                        """, unsafe_allow_html=True)
    else:
        st.info("No teams have been registered yet.")

def games_page():
    st.title("Game Scoring")
    
    if len(st.session_state.teams) < 2:
        st.warning("You need at least 2 teams registered to create games!")
        if st.button("Go to Teams", type="primary"):
            st.session_state.current_page = 'teams'
            st.rerun()
        return
    
    tab1, tab2 = st.tabs(["🎮 Score Game", "📋 Game History"])
    
    with tab1:
        score_game_interface()
    
    with tab2:
        game_history_interface()

def score_game_interface():
    st.subheader("Live Game Scoring")
    
    team_names = list(st.session_state.teams.keys())
    
    col1, col2 = st.columns(2)
    with col1:
        team1 = st.selectbox("Select Team 1", team_names, key="team1_select")
    with col2:
        team2_options = [t for t in team_names if t != team1]
        team2 = st.selectbox("Select Team 2", team2_options, key="team2_select")
    
    if team1 and team2:
        if 'current_game_key' not in st.session_state or st.session_state.current_game_key is None:
            st.session_state.current_game_key = f"{team1}_vs_{team2}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        game_key = st.session_state.current_game_key
        
        # Initialize game if not exists
        if game_key not in st.session_state.games:
            game_data = {
                'team1': team1,
                'team2': team2,
                'sets': {
                    'set1': {'team1_score': 0, 'team2_score': 0},
                    'set2': {'team1_score': 0, 'team2_score': 0}
                },
                'completed': False,
                'winner': None,
                'start_time': datetime.now().isoformat()
            }
            st.session_state.games[game_key] = game_data
            save_game_to_db(game_key, game_data)
        
        current_game = st.session_state.games[game_key]
        
        # Display match
        st.markdown(f"""
        <div class="card">
            <div class="vs-text">{team1} vs {team2}</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Score interface for each set
        score_updated = False
        for set_num in range(1, SETS_PER_GAME + 1):
            set_key = f'set{set_num}'
            
            st.subheader(f"Set {set_num}")
            
            col1, col2, col3 = st.columns([2, 1, 2])
            
            with col1:
                st.markdown(f"""
                <div class="score-card">
                    <div class="team-name">{team1}</div>
                    <div class="score-display">{current_game['sets'][set_key]['team1_score']}</div>
                </div>
                """, unsafe_allow_html=True)
                
                score_col1, score_col2 = st.columns(2)
                with score_col1:
                    if st.button(f"➕ +1", key=f"{set_key}_team1_plus"):
                        current_game['sets'][set_key]['team1_score'] += 1
                        score_updated = True
                with score_col2:
                    if st.button(f"➖ -1", key=f"{set_key}_team1_minus"):
                        if current_game['sets'][set_key]['team1_score'] > 0:
                            current_game['sets'][set_key]['team1_score'] -= 1
                            score_updated = True
            
            with col2:
                st.markdown('<div class="vs-text">VS</div>', unsafe_allow_html=True)
            
            with col3:
                st.markdown(f"""
                <div class="score-card">
                    <div class="team-name">{team2}</div>
                    <div class="score-display">{current_game['sets'][set_key]['team2_score']}</div>
                </div>
                """, unsafe_allow_html=True)
                
                score_col1, score_col2 = st.columns(2)
                with score_col1:
                    if st.button(f"➕ +1", key=f"{set_key}_team2_plus"):
                        current_game['sets'][set_key]['team2_score'] += 1
                        score_updated = True
                with score_col2:
                    if st.button(f"➖ -1", key=f"{set_key}_team2_minus"):
                        if current_game['sets'][set_key]['team2_score'] > 0:
                            current_game['sets'][set_key]['team2_score'] -= 1
                            score_updated = True
        
        # Save to database if score updated
        if score_updated:
            save_game_to_db(game_key, current_game)
            st.rerun()
        
        # Complete game button
        col1, col2, col3 = st.columns([1, 1, 1])
        with col2:
            if st.button("🏁 Complete Game", type="primary", use_container_width=True):
                # Determine winner
                team1_sets = 0
                team2_sets = 0
                
                for set_num in range(1, SETS_PER_GAME + 1):
                    set_key = f'set{set_num}'
                    t1_score = current_game['sets'][set_key]['team1_score']
                    t2_score = current_game['sets'][set_key]['team2_score']
                    
                    if t1_score > t2_score:
                        team1_sets += 1
                    elif t2_score > t1_score:
                        team2_sets += 1
                
                if team1_sets > team2_sets:
                    current_game['winner'] = team1
                elif team2_sets > team1_sets:
                    current_game['winner'] = team2
                else:
                    current_game['winner'] = 'Split'
                
                current_game['completed'] = True
                current_game['end_time'] = datetime.now().isoformat()
                
                # Save to database
                save_game_to_db(game_key, current_game)
                
                # Reset for new game
                st.session_state.current_game_key = None
                
                st.success(f"Game completed! Winner: {current_game['winner']}")
                st.balloons()
                st.rerun()

def calculate_standings():
    """Calculate team standings"""
    standings = {}
    
    for team_name, team_data in st.session_state.teams.items():
        standings[team_name] = {
            'pool': team_data.get('pool', 'A'),
            'games_played': 0,
            'set_wins': 0,
            'set_losses': 0,
            'points_for': 0,
            'points_against': 0,
            'point_differential': 0
        }
    
    for game_data in st.session_state.games.values():
        if game_data.get('completed', False):
            team1 = game_data['team1']
            team2 = game_data['team2']
            
            if team1 in standings and team2 in standings:
                standings[team1]['games_played'] += 1
                standings[team2]['games_played'] += 1
                
                for set_num in range(1, SETS_PER_GAME + 1):
                    set_key = f'set{set_num}'
                    t1_score = game_data['sets'][set_key]['team1_score']
                    t2_score = game_data['sets'][set_key]['team2_score']
                    
                    standings[team1]['points_for'] += t1_score
                    standings[team1]['points_against'] += t2_score
                    standings[team2]['points_for'] += t2_score
                    standings[team2]['points_against'] += t1_score
                    
                    if t1_score > t2_score:
                        standings[team1]['set_wins'] += 1
                        standings[team2]['set_losses'] += 1
                    elif t2_score > t1_score:
                        standings[team2]['set_wins'] += 1
                        standings[team1]['set_losses'] += 1
                
                standings[team1]['point_differential'] = standings[team1]['points_for'] - standings[team1]['points_against']
                standings[team2]['point_differential'] = standings[team2]['points_for'] - standings[team2]['points_against']
    
    return standings

def live_scoreboard_page():
    st.title("🔴 LIVE TOURNAMENT SCOREBOARD")
    st.markdown("*Data persists in database - refresh anytime!*")
    
    # CRITICAL FIX: Always reload fresh data from database on live page
    st.session_state.teams = load_teams_from_db()
    st.session_state.games = load_games_from_db()
    
    # Add refresh button for manual updates
    col1, col2, col3 = st.columns([2, 1, 2])
    with col2:
        if st.button("🔄 Refresh Scores", type="primary", use_container_width=True):
            st.rerun()
    
    # Current Games Section
    st.subheader("⚡ LIVE GAMES")
    
    active_games = {k: v for k, v in st.session_state.games.items() if not v.get('completed', False)}
    
    if active_games:
        # Group active games by pool
        pool_games = {'A': [], 'B': [], 'C': [], 'Inter-Pool': []}
        
        for game_key, game_data in active_games.items():
            team1 = game_data['team1']
            team2 = game_data['team2']
            team1_pool = st.session_state.teams.get(team1, {}).get('pool', 'A')
            team2_pool = st.session_state.teams.get(team2, {}).get('pool', 'A')
            
            if team1_pool == team2_pool:
                pool_games[team1_pool].append((game_key, game_data))
            else:
                pool_games['Inter-Pool'].append((game_key, game_data))
        
        # Display live games by pool
        for pool_name in ['A', 'B', 'C', 'Inter-Pool']:
            if pool_games[pool_name]:
                if pool_name == 'Inter-Pool':
                    st.markdown(f"### 🔥 Inter-Pool Games - LIVE")
                else:
                    st.markdown(f"### 🏊 Pool {pool_name} - LIVE")
                
                for game_key, game_data in pool_games[pool_name]:
                    team1_pool = st.session_state.teams.get(game_data['team1'], {}).get('pool', 'A')
                    team2_pool = st.session_state.teams.get(game_data['team2'], {}).get('pool', 'A')
                    
                    col1, col2, col3 = st.columns([2, 1, 2])
                    
                    with col1:
                        if pool_name == 'Inter-Pool':
                            st.markdown(f"""
                            <div class="score-card">
                                <div class="team-name">{game_data['team1']}</div>
                                <div style="color: #8B9F6B;">Pool {team1_pool}</div>
                            </div>
                            """, unsafe_allow_html=True)
                        else:
                            st.markdown(f"""
                            <div class="score-card">
                                <div class="team-name">{game_data['team1']}</div>
                            </div>
                            """, unsafe_allow_html=True)
                    
                    with col2:
                        st.markdown('<div class="vs-text">VS</div>', unsafe_allow_html=True)
                        for set_num in range(1, SETS_PER_GAME + 1):
                            set_key = f'set{set_num}'
                            t1_score = game_data['sets'][set_key]['team1_score']
                            t2_score = game_data['sets'][set_key]['team2_score']
                            st.write(f"**Set {set_num}:** {t1_score} - {t2_score}")
                    
                    with col3:
                        if pool_name == 'Inter-Pool':
                            st.markdown(f"""
                            <div class="score-card">
                                <div class="team-name">{game_data['team2']}</div>
                                <div style="color: #8B9F6B;">Pool {team2_pool}</div>
                            </div>
                            """, unsafe_allow_html=True)
                        else:
                            st.markdown(f"""
                            <div class="score-card">
                                <div class="team-name">{game_data['team2']}</div>
                            </div>
                            """, unsafe_allow_html=True)
                    
                    st.markdown("---")
                
                st.markdown("---")
    else:
        st.info("No games currently in progress")
    
    # Tournament Standings
    st.subheader("🏆 TOURNAMENT STANDINGS")
    
    standings = calculate_standings()
    
    if standings:
        overall_standings = list(standings.items())
        overall_standings.sort(key=lambda x: (x[1]['set_wins'], x[1]['point_differential']), reverse=True)
        
        standings_data = []
        for rank, (team_name, stats) in enumerate(overall_standings, 1):
            standings_data.append({
                'Rank': f"#{rank}",
                'Team': team_name,
                'Pool': stats['pool'],
                'Games': stats['games_played'],
                'Set Wins': stats['set_wins'],
                'Set Losses': stats['set_losses'],
                'Point Diff': f"+{stats['point_differential']}" if stats['point_differential'] > 0 else str(stats['point_differential'])
            })
        
        df_overall = pd.DataFrame(standings_data)
        st.dataframe(df_overall, use_container_width=True, hide_index=True)
    else:
        st.info("No games completed yet - standings will appear after games are played")

def game_history_interface():
    if not st.session_state.games:
        st.info("No games have been played yet.")
        return
    
    completed_games = {k: v for k, v in st.session_state.games.items() if v.get('completed', False)}
    
    if not completed_games:
        st.info("No completed games to display.")
        return
    
    st.subheader("Completed Games")
    
    # Group games by pool matchups
    pool_games = {
        'Pool A': [],
        'Pool B': [], 
        'Pool C': [],
        'Inter-Pool': []
    }
    
    for game_key, game_data in completed_games.items():
        team1 = game_data['team1']
        team2 = game_data['team2']
        
        # Get pool information for both teams
        team1_pool = st.session_state.teams.get(team1, {}).get('pool', 'A')
        team2_pool = st.session_state.teams.get(team2, {}).get('pool', 'A')
        
        # Determine which section this game belongs to
        if team1_pool == team2_pool:
            # Same pool game
            pool_games[f'Pool {team1_pool}'].append((game_key, game_data))
        else:
            # Inter-pool game
            pool_games['Inter-Pool'].append((game_key, game_data))
    
    # Display games by pool sections
    for section_name in ['Pool A', 'Pool B', 'Pool C', 'Inter-Pool']:
        if pool_games[section_name]:  # Only show section if there are games
            st.markdown(f"### {section_name} Games")
            
            for game_key, game_data in pool_games[section_name]:
                team1_pool = st.session_state.teams.get(game_data['team1'], {}).get('pool', 'A')
                team2_pool = st.session_state.teams.get(game_data['team2'], {}).get('pool', 'A')
                
                # Create title based on section type
                if section_name == 'Inter-Pool':
                    title = f"🏐 {game_data['team1']} (Pool {team1_pool}) vs {game_data['team2']} (Pool {team2_pool}) - Winner: {game_data['winner']}"
                else:
                    title = f"🏐 {game_data['team1']} vs {game_data['team2']} - Winner: {game_data['winner']}"
                
                with st.expander(title):
                    col1, col2 = st.columns(2)
                    
                    with col1:
                        st.write("**Set Scores:**")
                        for set_num in range(1, SETS_PER_GAME + 1):
                            set_key = f'set{set_num}'
                            t1_score = game_data['sets'][set_key]['team1_score']
                            t2_score = game_data['sets'][set_key]['team2_score']
                            st.write(f"Set {set_num}: {game_data['team1']} {t1_score} - {game_data['team2']} {t2_score}")
                    
                    with col2:
                        if game_data.get('start_time'):
                            start_time = datetime.fromisoformat(game_data['start_time'])
                            st.write(f"**Started:** {start_time.strftime('%Y-%m-%d %H:%M')}")
                        if game_data.get('end_time'):
                            end_time = datetime.fromisoformat(game_data['end_time'])
                            st.write(f"**Completed:** {end_time.strftime('%Y-%m-%d %H:%M')}")
                        
                        # Show pool information
                        st.write(f"**{game_data['team1']}:** Pool {team1_pool}")
                        st.write(f"**{game_data['team2']}:** Pool {team2_pool}")
            
            st.markdown("---")  # Add separator between sections
    
    if not any(pool_games.values()):
        st.info("No completed games to display.")

def main():
    st.set_page_config(
        page_title="KIJ Volleyball Tournament",
        page_icon="🏐",
        layout="wide",
        initial_sidebar_state="collapsed"
    )
    
    # Initialize session state with database data
    initialize_session_state()
    
    load_css()
    
    # Check database connection
    conn = get_db_connection()
    if not conn:
        st.error("❌ Database connection failed. Please check your DATABASE_URL environment variable.")
        st.stop()
    
    # Admin mode status display
    if st.session_state.admin_mode and st.session_state.admin_authenticated:
        mode_text = "🔑 Administrator Portal"
        # Add logout button
        st.markdown(f"""
        <div style="position: fixed; top: 10px; right: 10px; background: rgba(164, 184, 124, 0.9); 
                    padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; z-index: 1000;
                    backdrop-filter: blur(10px); color: white; font-weight: 500;">
            {mode_text}
        </div>
        """, unsafe_allow_html=True)
    elif st.session_state.admin_mode and not st.session_state.admin_authenticated:
        mode_text = "🔐 Login Required"
        st.markdown(f"""
        <div style="position: fixed; top: 10px; right: 10px; background: rgba(220, 53, 69, 0.9); 
                    padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; z-index: 1000;
                    backdrop-filter: blur(10px); color: white; font-weight: 500;">
            {mode_text}
        </div>
        """, unsafe_allow_html=True)
    else:
        mode_text = "👤 Player Portal"
        st.markdown(f"""
        <div style="position: fixed; top: 10px; right: 10px; background: rgba(108, 117, 125, 0.9); 
                    padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; z-index: 1000;
                    backdrop-filter: blur(10px); color: white; font-weight: 500;">
            {mode_text}
        </div>
        """, unsafe_allow_html=True)
    
    navigation()
    
    # Handle admin login requirement
    if st.session_state.admin_mode and not st.session_state.admin_authenticated:
        admin_login_page()
        return
    
    # Route to pages
    if st.session_state.current_page == 'home':
        home_page()
    elif st.session_state.current_page == 'teams':
        teams_page()
    elif st.session_state.current_page == 'games':
        games_page()
    elif st.session_state.current_page == 'live':
        live_scoreboard_page()

if __name__ == "__main__":
    main()