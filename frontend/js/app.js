/* ═══════════════════════════════════════════════════════════════
   app.js – Root application 
   KIJ Volleyball Tournament
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var h = React.createElement;
  var useState  = React.useState;
  var useEffect = React.useEffect;
  var useRef    = React.useRef;

  var C = window.Components;

  function App() {
    // ── State ───────────────────────────────────────────────────
    var _page  = useState('home');
    var _admin = useState(false);
    var _auth  = useState(false);
    var _teams = useState({});
    var _games = useState({});
    var _toast = useState(null);

    var page          = _page[0],  setPage          = _page[1];
    var adminMode     = _admin[0], setAdminMode     = _admin[1];
    var authenticated = _auth[0],  setAuthenticated  = _auth[1];
    var teams         = _teams[0], setTeams         = _teams[1];
    var games         = _games[0], setGames         = _games[1];
    var toast         = _toast[0], setToast         = _toast[1];

    var toastTimer = useRef(null);

    // ── Toast helper ────────────────────────────────────────────
    function showToast(msg, type) {
      setToast({ message: msg, type: type || 'success' });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(function () { setToast(null); }, 3000);
    }

    // ── Data loaders ────────────────────────────────────────────
    function loadTeams() {
      Api.getTeams().then(setTeams).catch(function () {});
    }
    function loadGames() {
      Api.getGames().then(setGames).catch(function () {});
    }
    function loadAll() { loadTeams(); loadGames(); }

    // ── Initial load + WebSocket ────────────────────────────────
    useEffect(function () {
      loadAll();

      // Connect WebSocket
      WS.connect();

      function onWsMessage(msg) {
        if (msg.type === 'init') {
          setTeams(msg.teams);
          setGames(msg.games);
        } else if (msg.type === 'teams_updated') {
          setTeams(msg.teams);
        } else if (msg.type === 'score_updated' || msg.type === 'games_updated' || msg.type === 'game_completed') {
          setGames(msg.games);
        } else if (msg.type === 'tournament_reset') {
          setTeams({});
          setGames({});
        }
      }
      WS.onMessage(onWsMessage);

      return function () { WS.offMessage(onWsMessage); };
    }, []);

    // ── Navigation handler ──────────────────────────────────────
    function navigate(p) {
      setPage(p);
      // Refresh data when entering live or games
      if (p === 'live' || p === 'games') loadAll();
    }

    function handleAdminToggle() {
      if (adminMode && authenticated) {
    // Logout
        setAdminMode(false);
        setAuthenticated(false);
        setPage('home');
        showToast('Logged out', 'success');
  } else {
    // Enter admin mode → show login
        setAdminMode(true);
        setPage('admin_login');
  }
}

   

    function handleLogin() {
      setAuthenticated(true);
      setPage('teams');
      showToast('Admin login successful!', 'success');
    }

    // ── Render ──────────────────────────────────────────────────────
var content;

if (page === 'admin_login') {
  content = h(C.AdminLoginPage, { onLogin: handleLogin });
} else if (page === 'home') {
  content = h(C.HomePage, { onNav: navigate });
} else if (page === 'teams') {
  content = h(C.TeamsPage, {
    teams: teams,
    admin: adminMode,
    authenticated: authenticated,
    onTeamsChanged: loadAll,
    showToast: showToast,
  });
} else if (page === 'games') {
  content = h(C.GamesPage, {
    teams: teams,
    games: games,
    onGamesChanged: loadAll,
    onNav: navigate,
    showToast: showToast,
  });
} else if (page === 'live') {
  content = h(C.LivePage, {
    teams: teams,
    games: games,
    onRefresh: loadAll,
  });
}      

    return h('div', null,
      h(C.StatusBadge, { admin: adminMode, authenticated: authenticated }),
      h(C.NavBar, {
        page: page,
        admin: adminMode,
        authenticated: authenticated,
        onNav: navigate,
        onAdminToggle: handleAdminToggle,
      }),
      h('div', { id: 'app' }, content),
      toast && h(C.Toast, toast)
    );
  }

  // ── Mount ─────────────────────────────────────────────────────
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App));

})();