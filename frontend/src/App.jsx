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
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ── Toast ────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Data loaders ─────────────────────────────────────────────
  function loadTeams() {
    Api.getTeams().then(setTeams).catch(() => {});
  }
  function loadGames() {
    Api.getGames().then(setGames).catch(() => {});
  }
  function loadAll() {
    loadTeams();
    loadGames();
  }

  // ── Initial load + WebSocket ──────────────────────────────────
  useEffect(() => {
    loadAll();
    WS.connect();

    function onWsMessage(msg) {
      if (msg.type === 'init') {
        setTeams(msg.teams);
        setGames(msg.games);
      } else if (msg.type === 'teams_updated') {
        setTeams(msg.teams);
      } else if (
        msg.type === 'score_updated' ||
        msg.type === 'games_updated' ||
        msg.type === 'game_completed'
      ) {
        setGames(msg.games);
      } else if (msg.type === 'tournament_reset') {
        setTeams({});
        setGames({});
      }
    }

    WS.onMessage(onWsMessage);
    return () => WS.offMessage(onWsMessage);
  }, []);

  // ── Navigation ────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────
  function renderPage() {
    switch (page) {
      case 'home':
        return <HomePage onNav={navigate} />;
      case 'admin_login':
        return <AdminLoginPage onLogin={handleLogin} />;
      case 'teams':
        return (
          <TeamsPage
            teams={teams}
            admin={adminMode}
            authenticated={authenticated}
            onTeamsChanged={loadAll}
            showToast={showToast}
          />
        );
      case 'games':
        return (
          <GamesPage
            teams={teams}
            games={games}
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
