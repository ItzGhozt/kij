/* ═══════════════════════════════════════════════════════════════
   api.js – HTTP client + WebSocket for KIJ Volleyball Tournament
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // Base URL for the FastAPI backend (change in production)
  var BASE = 'https://kij-backend.onrender.com';
  var WS_URL = 'wss://kij-backend.onrender.com/ws';

  // ── HTTP helpers ────────────────────────────────────────────────

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(BASE + path, opts).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.detail || 'Request failed');
        });
      }
      return res.json();
    });
  }

  var Api = {
    // Auth
    login: function (username, password) {
      return request('POST', '/api/auth/login', { username: username, password: password });
    },

    // Teams
    getTeams: function ()            { return request('GET', '/api/teams'); },
    createTeam: function (data)      { return request('POST', '/api/teams', data); },
    deleteTeam: function (name)      { return request('DELETE', '/api/teams/' + encodeURIComponent(name)); },

    // Games
    getGames: function ()            { return request('GET', '/api/games'); },
    createGame: function (t1, t2)    { return request('POST', '/api/games', { team1: t1, team2: t2 }); },
    updateScore: function (data)     { return request('POST', '/api/games/score', data); },
    completeGame: function (gameKey) { return request('POST', '/api/games/complete', { game_key: gameKey }); },

    // Standings
    getStandings: function ()        { return request('GET', '/api/standings'); },

    // Admin
    resetTournament: function ()     { return request('POST', '/api/admin/reset'); },
  };

  // ── WebSocket manager ──────────────────────────────────────────

  var _ws = null;
  var _listeners = [];
  var _reconnectTimer = null;

  function connectWS() {
    if (_ws && (_ws.readyState === WebSocket.OPEN || _ws.readyState === WebSocket.CONNECTING)) return;

    _ws = new WebSocket(WS_URL);

    _ws.onopen = function () {
      console.log('[WS] connected');
      // Keep-alive ping every 25 s
      if (_ws._ping) clearInterval(_ws._ping);
      _ws._ping = setInterval(function () {
        if (_ws.readyState === WebSocket.OPEN) _ws.send('ping');
      }, 25000);
    };

    _ws.onmessage = function (evt) {
      try {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'pong') return;
        _listeners.forEach(function (fn) { fn(msg); });
      } catch (e) { /* ignore */ }
    };

    _ws.onclose = function () {
      console.log('[WS] closed – reconnecting in 3 s');
      if (_ws._ping) clearInterval(_ws._ping);
      clearTimeout(_reconnectTimer);
      _reconnectTimer = setTimeout(connectWS, 3000);
    };

    _ws.onerror = function () {
      _ws.close();
    };
  }

  var WS = {
    connect: connectWS,
    onMessage: function (fn) { _listeners.push(fn); },
    offMessage: function (fn) {
      _listeners = _listeners.filter(function (f) { return f !== fn; });
    },
  };

  // Expose globally
  global.Api = Api;
  global.WS  = WS;

})(window);