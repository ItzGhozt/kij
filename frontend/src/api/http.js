const BASE = 'https://kij-backend.onrender.com';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const Api = {
  // Auth
  login: (username, password) =>
    request('POST', '/api/auth/login', { username, password }),

  // Teams
  getTeams: () => request('GET', '/api/teams'),
  createTeam: (data) => request('POST', '/api/teams', data),
  deleteTeam: (name) => request('DELETE', `/api/teams/${encodeURIComponent(name)}`),

  // Games
  getGames: () => request('GET', '/api/games'),
  createGame: (team1, team2) => request('POST', '/api/games', { team1, team2 }),
  updateScore: (data) => request('POST', '/api/games/score', data),
  completeGame: (game_key) => request('POST', '/api/games/complete', { game_key }),

  // Standings
  getStandings: () => request('GET', '/api/standings'),

  // Admin
  resetTournament: () => request('POST', '/api/admin/reset'),
};
