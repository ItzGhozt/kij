import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Api } from './api/http';
import { WS } from './api/websocket';

import NavBar from './components/NavBar';
import StatusBadge from './components/StatusBadge';
import Toast from './components/Toast';

import HomePage from './pages/HomePage';
import AdminLoginPage from './pages/AdminLoginPage';
import TeamsPage from './pages/TeamsPage';
import GamesPage from './pages/GamesPage';
import LivePage from './pages/LivePage';

export default function App() {
  const [page, setPage] = useState('home');
  const [adminMode, setAdminMode] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState({});
  const [games, setGames] = useState({});
  const [phase, setPhase] = useState('pool_play');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function loadTeams() { Api.getTeams().then(setTeams).catch(() => {}); }
  function loadGames() { Api.getGames().then(setGames).catch(() => {}); }
  function loadAll() { loadTeams(); loadGames(); }

  useEffect(() => {
    loadAll();
    Api.getSettings().then(s => setPhase(s.phase || 'pool_play')).catch(() => {});
    WS.connect();

    function onWsMessage(msg) {
      if (msg.type === 'init') {
        setTeams(msg.teams);
        setGames(msg.games);
        if (msg.settings?.phase) setPhase(msg.settings.phase);
      } else if (msg.type === 'teams_updated') {
        setTeams(msg.teams);
      } else if (['score_updated', 'games_updated', 'game_completed'].includes(msg.type)) {
        setGames(msg.games);
      } else if (msg.type === 'phase_updated') {
        setPhase(msg.phase);
      } else if (msg.type === 'tournament_reset') {
        setTeams({});
        setGames({});
        setPhase('pool_play');
      }
    }

    WS.onMessage(onWsMessage);
    return () => WS.offMessage(onWsMessage);
  }, []);

  function navigate(p) {
    setPage(p);
    if (p === 'live' || p === 'games') loadAll();
  }

  function handleAdminToggle() {
    if (adminMode && authenticated) {
      setAdminMode(false);
      setAuthenticated(false);
      setPage('home');
      showToast('Logged out', 'success');
    } else {
      setAdminMode(true);
      setPage('admin_login');
    }
  }

  function handleLogin() {
    setAuthenticated(true);
    setPage('teams');
    showToast('Admin login successful!', 'success');
  }

  function renderPage() {
    switch (page) {
      case 'home': return <HomePage onNav={navigate} />;
      case 'admin_login': return <AdminLoginPage onLogin={handleLogin} />;
      case 'teams':
        return (
          <TeamsPage
            teams={teams}
            games={games}
            admin={adminMode}
            authenticated={authenticated}
            phase={phase}
            onPhaseChange={setPhase}
            onTeamsChanged={loadAll}
            onGamesChanged={loadAll}
            showToast={showToast}
          />
        );
      case 'games':
        return (
          <GamesPage
            teams={teams}
            games={games}
            phase={phase}
            admin={adminMode}
            authenticated={authenticated}
            onGamesChanged={loadAll}
            onNav={navigate}
            showToast={showToast}
          />
        );
      case 'live':
        return <LivePage teams={teams} games={games} onRefresh={loadAll} />;
      default:
        return <HomePage onNav={navigate} />;
    }
  }

  return (
    <div>
      <StatusBadge admin={adminMode} authenticated={authenticated} />
      <NavBar
        page={page}
        admin={adminMode}
        authenticated={authenticated}
        onNav={navigate}
        onAdminToggle={handleAdminToggle}
      />
      <div id="app">{renderPage()}</div>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}