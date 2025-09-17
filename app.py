import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import plotly.express as px
import plotly.graph_objects as go

from config import MAX_TEAMS, SETS_PER_GAME
from database import init_database, get_all_teams, get_all_games, add_team, save_game, delete_all_data

# Initialize database
if not init_database():
    st.error("Failed to initialize database. Please check your MySQL connection.")

# Initialize session state
if 'current_page' not in st.session_state:
    st.session_state.current_page = 'home'
if 'teams' not in st.session_state:
    st.session_state.teams = get_all_teams()
if 'games' not in st.session_state:
    st.session_state.games = get_all_games()
if 'admin_mode' not in st.session_state:
    st.session_state.admin_mode = False
if 'current_game_key' not in st.session_state:
    st.session_state.current_game_key = None

# Custom CSS with Golden Summer Fields color palette
def load_css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    .main > div {
        padding: 0;
    }
    
    .stApp {
        background: linear-gradient(135deg, #b8d4b0 0%, #d4c5a0 50%, #e8d5b7 100%);
        min-height: 100vh;
    }
    
    /* Clean Navigation Bar - centered and blended */
    .nav-container {
        background: transparent;
        padding: 0.5rem 0;
        display: flex;
        justify-content: center;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 100;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .nav-item {
        color: rgba(45, 90, 45, 0.8) !important;
        text-decoration: none !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        padding: 0.4rem 0.8rem !important;
        background: transparent !important;
        border: none !important;
        cursor: pointer !important;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        transition: all 0.3s ease !important;
        border-radius: 0 !important;
        margin: 0 0.2rem !important;
    }
    
    .nav-item:hover {
        background: transparent !important;
        color: rgba(45, 90, 45, 1) !important;
        transform: none !important;
    }
    
    /* Hero section - exact gradient like reference */
    .hero-section {
        background: linear-gradient(135deg, #b8d4b0 0%, #d4c5a0 50%, #e8d5b7 100%);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 4rem 2rem;
        position: relative;
        overflow: hidden;
    }
    
    .hero-title {
        font-family: 'Inter', sans-serif;
        font-size: 4rem;
        font-weight: 700;
        color: #2d5a2d;
        margin-bottom: 1rem;
        text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.3);
        z-index: 10;
        position: relative;
        text-transform: uppercase;
        letter-spacing: 2px;
    }
    
    .hero-subtitle {
        font-family: 'Inter', sans-serif;
        font-size: 1.2rem;
        color: #4a6b4a;
        margin-bottom: 3rem;
        z-index: 10;
        position: relative;
        font-weight: 400;
        letter-spacing: 1px;
    }
    
    .hero-cta {
        background: rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-radius: 1rem;
        padding: 2rem;
        max-width: 500px;
        z-index: 10;
        position: relative;
    }
    
    .cta-text {
        color: #2d5a2d;
        font-size: 1.4rem;
        font-weight: 600;
        margin-bottom: 1rem;
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
    
    .success-message {
        background: linear-gradient(135deg, #A4B87C, #8B9F6B);
        color: white;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1rem 0;
        font-weight: 500;
    }
    
    .score-button {
        background: linear-gradient(135deg, #A4B87C, #8B9F6B) !important;
        color: white !important;
        border: none !important;
        border-radius: 0.5rem !important;
        padding: 0.5rem 1rem !important;
        font-weight: 500 !important;
        margin: 0.2rem !important;
        transition: all 0.3s ease !important;
        width: 100% !important;
    }
    
    .score-button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 5px 15px rgba(164, 184, 124, 0.4) !important;
    }
    
    .primary-button {
        background: linear-gradient(135deg, #BCA888, #D4C5A0) !important;
        color: white !important;
        border: none !important;
        border-radius: 0.5rem !important;
        padding: 0.75rem 2rem !important;
        font-weight: 600 !important;
        font-size: 1.1rem !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 15px rgba(188, 168, 136, 0.3) !important;
    }
    
    .primary-button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px rgba(188, 168, 136, 0.5) !important;
    }
    
    /* Hide Streamlit elements */
    .stDeployButton {display:none;}
    .stDecoration {display:none;}
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Custom button styles - blend seamlessly with background */
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
    
    div.stButton > button:focus {
        background: transparent !important;
        color: rgba(45, 90, 45, 0.8) !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
    }
    
    div.stButton > button:active {
        background: transparent !important;
        color: rgba(45, 90, 45, 0.8) !important;
        border: none !important;
        box-shadow: none !important;
        outline: none !important;
    }
    
    /* Special styling for reset button */
    .reset-button {
        background: linear-gradient(135deg, #ff6b6b, #ee5a52) !important;
        color: white !important;
        border: none !important;
        border-radius: 0.5rem !important;
        padding: 0.75rem 1.5rem !important;
        font-weight: 600 !important;
        margin: 1rem 0 !important;
        transition: all 0.3s ease !important;
    }
    
    .reset-button:hover {
        background: linear-gradient(135deg, #ff5252, #e53935) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4) !important;
    }
    </style>
    """, unsafe_allow_html=True)

def navigation():
    admin_text = "PLAYER" if st.session_state.admin_mode else "ADMIN"

    st.markdown('<div class="nav-container">', unsafe_allow_html=True)
    # Tighter spacing with smaller column weights and minimal gap
    col1, col2, col3, col4, col5 = st.columns([0.1, 0.1, 0.1, 0.1, 0.1], gap="small")

    with col1:
        if st.button("HOME", key="nav_home", use_container_width=True):
            st.session_state.current_page = "home"
            st.rerun()

    with col2:
        if st.button("TEAMS", key="nav_teams", use_container_width=True):
            st.session_state.current_page = "teams"
            st.rerun()

    with col3:
        if st.button("GAMES", key="nav_games", use_container_width=True):
            st.session_state.current_page = "games"
            st.rerun()

    with col4:
        if st.button("LIVE", key="nav_live", use_container_width=True):
            st.session_state.current_page = "live"
            st.rerun()

    with col5:
        if st.button(admin_text, key="nav_admin", use_container_width=True):
            st.session_state.admin_mode = not st.session_state.admin_mode
            st.rerun()

    st.markdown('</div>', unsafe_allow_html=True)

def home_page():
    st.markdown("""
    <div class="hero-section">
        <h1 class="hero-title">KIJ Volleyball Tournament</h1>
        <p class="hero-subtitle">GRASS VOLLEYBALL 2025</p>
        <div class="hero-cta">
            <div class="cta-text">Ready to Play?</div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Score a Game button positioned higher up in the hero section
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown('<div style="text-align: center; margin-top: -25rem; position: relative; z-index: 20;">', unsafe_allow_html=True)
        if st.button("🏐 Score a Game", type="primary", use_container_width=True):
            st.session_state.current_page = 'games'
            st.rerun()
        st.markdown('</div>', unsafe_allow_html=True)

def teams_page():
    st.title("Team Management")
    
    if st.session_state.admin_mode:
        st.subheader("🔐 Admin View - All Teams")
        
        # Tournament Reset Feature - Admin Only
        with st.expander("⚠️ Tournament Reset", expanded=False):
            st.warning("This will delete ALL teams and games. This action cannot be undone!")
            
            col1, col2, col3 = st.columns([1, 1, 1])
            with col2:
                if st.button("🗑️ Reset Tournament", key="reset_tournament", help="Click to reset entire tournament"):
                    # Show confirmation dialog
                    if 'show_reset_confirmation' not in st.session_state:
                        st.session_state.show_reset_confirmation = True
                        st.rerun()
            
            # Confirmation dialog
            if st.session_state.get('show_reset_confirmation', False):
                st.error("⚠️ Are you absolutely sure you want to reset the entire tournament?")
                col1, col2, col3 = st.columns(3)
                
                with col1:
                    if st.button("✅ Yes, Reset Everything", type="primary", key="confirm_reset"):
                        # Reset all data in database
                        if delete_all_data():
                            st.session_state.teams = {}
                            st.session_state.games = {}
                            st.session_state.current_game_key = None
                            st.session_state.show_reset_confirmation = False
                            st.success("Tournament has been completely reset!")
                            st.balloons()
                            st.rerun()
                        else:
                            st.error("Failed to reset tournament. Please try again.")
                
                with col2:
                    if st.button("❌ Cancel", key="cancel_reset"):
                        st.session_state.show_reset_confirmation = False
                        st.rerun()
        
        if st.session_state.teams:
            df = pd.DataFrame([
                {
                    'Team Name': name,
                    'Player 1': data.get('player1', ''),
                    'Player 2': data.get('player2', ''),
                    'Pool': data.get('pool', 'N/A')
                }
                for name, data in st.session_state.teams.items()
            ])
            # Sort by pool
            df = df.sort_values('Pool')
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No teams registered yet.")
        
        # Team Registration - ONLY FOR ADMIN
        with st.expander("🆕 Register New Team", expanded=True):
            if len(st.session_state.teams) >= MAX_TEAMS:
                st.error(f"Maximum of {MAX_TEAMS} teams allowed!")
            else:
                with st.form("team_registration"):
                    team_name = st.text_input("Team Name", placeholder="Enter team name")
                    player1 = st.text_input("Player 1 Name", placeholder="First player name")
                    player2 = st.text_input("Player 2 Name", placeholder="Second player name")
                    pool = st.selectbox("Pool Assignment", options=["A", "B", "C"], help="Assign team to Pool A, B, or C")
                    
                    if st.form_submit_button("Register Team", type="primary"):
                        if team_name and player1 and player2:
                            if team_name not in st.session_state.teams:
                                if add_team(team_name, player1, player2, pool):
                                    st.session_state.teams = get_all_teams()
                                    st.success(f"Team '{team_name}' registered successfully in Pool {pool}!")
                                    st.balloons()
                                    # Clear the form by triggering a rerun
                                    st.rerun()
                                else:
                                    st.error("Failed to register team. Please try again.")
                            else:
                                st.error("Team name already exists!")
                        else:
                            st.error("Please fill in all fields!")
    
    else:
        # Player View - can only see teams, cannot register
        st.subheader("👤 Player View - Registered Teams")
        st.info("Only administrators can register new teams. Contact an admin to add your team.")
    
    # Current Teams Display (for both admin and players) - sorted by pools
    if st.session_state.teams:
        st.subheader("Registered Teams by Pool")
        
        # Group teams by pool
        pools = {'A': [], 'B': [], 'C': []}
        for team_name, team_data in st.session_state.teams.items():
            pool = team_data.get('pool', 'A')  # Default to Pool A if no pool assigned
            pools[pool].append((team_name, team_data))
        
        # Display teams by pool
        for pool_name in ['A', 'B', 'C']:
            if pools[pool_name]:  # Only show pool if it has teams
                st.markdown(f"### 🏊 Pool {pool_name}")
                cols = st.columns(min(3, len(pools[pool_name])))
                
                for idx, (team_name, team_data) in enumerate(pools[pool_name]):
                    with cols[idx % 3]:
                        st.markdown(f"""
                        <div class="score-card">
                            <div class="team-name">🏐 {team_name}</div>
                            <div>👤 {team_data['player1']}</div>
                            <div>👤 {team_data['player2']}</div>
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
        # Create a unique game key that persists during the session
        if 'current_game_key' not in st.session_state or st.session_state.current_game_key is None:
            st.session_state.current_game_key = f"{team1}_vs_{team2}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        game_key = st.session_state.current_game_key
        
        # Initialize game if not exists
        if game_key not in st.session_state.games:
            st.session_state.games[game_key] = {
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
        
        current_game = st.session_state.games[game_key]
        
        # Display current match
        st.markdown(f"""
        <div class="card">
            <div class="vs-text">{team1} vs {team2}</div>
        </div>
        """, unsafe_allow_html=True)
        
        # Score interface for each set
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
                    if st.button(f"➕ +1", key=f"{set_key}_team1_plus", help="Add point"):
                        current_game['sets'][set_key]['team1_score'] += 1
                        save_game(game_key, current_game)
                        st.rerun()
                with score_col2:
                    if st.button(f"➖ -1", key=f"{set_key}_team1_minus", help="Remove point"):
                        if current_game['sets'][set_key]['team1_score'] > 0:
                            current_game['sets'][set_key]['team1_score'] -= 1
                            save_game(game_key, current_game)
                            st.rerun()
            
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
                    if st.button(f"➕ +1", key=f"{set_key}_team2_plus", help="Add point"):
                        current_game['sets'][set_key]['team2_score'] += 1
                        save_game(game_key, current_game)
                        st.rerun()
                with score_col2:
                    if st.button(f"➖ -1", key=f"{set_key}_team2_minus", help="Remove point"):
                        if current_game['sets'][set_key]['team2_score'] > 0:
                            current_game['sets'][set_key]['team2_score'] -= 1
                            save_game(game_key, current_game)
                            st.rerun()
        
        # Complete game button
        col1, col2, col3 = st.columns([1, 1, 1])
        with col2:
            if st.button("🏁 Complete Game", type="primary", use_container_width=True):
                # Determine winner based on sets won
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
                    current_game['winner'] = 'Tie'
                
                current_game['completed'] = True
                current_game['end_time'] = datetime.now().isoformat()
                
                # Save to database
                save_game(game_key, current_game)
                
                # Refresh games from database
                st.session_state.games = get_all_games()
                
                # Reset the current game key so a new game can be started
                st.session_state.current_game_key = None
                
                st.success(f"Game completed! Winner: {current_game['winner']}")
                st.balloons()
                st.rerun()

def calculate_standings():
    """Calculate team standings based on set wins and point differential"""
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
    
    # Calculate stats from completed games
    for game_data in st.session_state.games.values():
        if game_data.get('completed', False):
            team1 = game_data['team1']
            team2 = game_data['team2']
            
            if team1 in standings and team2 in standings:
                standings[team1]['games_played'] += 1
                standings[team2]['games_played'] += 1
                
                team1_sets = 0
                team2_sets = 0
                
                for set_num in range(1, SETS_PER_GAME + 1):
                    set_key = f'set{set_num}'
                    t1_score = game_data['sets'][set_key]['team1_score']
                    t2_score = game_data['sets'][set_key]['team2_score']
                    
                    standings[team1]['points_for'] += t1_score
                    standings[team1]['points_against'] += t2_score
                    standings[team2]['points_for'] += t2_score
                    standings[team2]['points_against'] += t1_score
                    
                    if t1_score > t2_score:
                        team1_sets += 1
                        standings[team1]['set_wins'] += 1
                        standings[team2]['set_losses'] += 1
                    elif t2_score > t1_score:
                        team2_sets += 1
                        standings[team2]['set_wins'] += 1
                        standings[team1]['set_losses'] += 1
                
                # Calculate point differential
                standings[team1]['point_differential'] = standings[team1]['points_for'] - standings[team1]['points_against']
                standings[team2]['point_differential'] = standings[team2]['points_for'] - standings[team2]['points_against']
    
    return standings

def live_scoreboard_page():
    st.title("🔴 LIVE TOURNAMENT SCOREBOARD")
    
    # Auto-refresh every 5 seconds
    st.markdown("*Page auto-refreshes to show live updates*")
    
    # Current Games Section
    st.subheader("⚡ LIVE GAMES")
    
    active_games = {k: v for k, v in st.session_state.games.items() if not v.get('completed', False)}
    
    if active_games:
        # Group active games by pool
        pool_games = {'A': [], 'B': [], 'C': [], 'Inter-Pool': []}
        
        for game_key, game_data in active_games.items():
            team1 = game_data['team1']
            team2 = game_data