const BASE = 'https://kij.onrender.com';

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const Api = {
  login: (username, password) => request('POST', '/api/auth/login', { username, password }),
  getTeams: () => request('GET', '/api/teams'),
  createTeam: (data) => request('POST', '/api/teams', data),
  deleteTeam: (name) => request('DELETE', `/api/teams/${encodeURIComponent(name)}`),
  getGames: () => request('GET', '/api/games'),
  createGame: (team1, team2, phase = 'pool_play') => request('POST', '/api/games', { team1, team2, phase }),
  updateScore: (data) => request('POST', '/api/games/score', data),
  completeGame: (game_key) => request('POST', '/api/games/complete', { game_key }),
  getStandings: () => request('GET', '/api/standings'),
  getPhase: () => request('GET', '/api/settings/phase'),
  setPhase: (phase) => request('POST', '/api/settings/phase', { phase }),
  generateSchedule: () => request('POST', '/api/schedule/generate'),
  resetTournament: () => request('POST', '/api/admin/reset'),
};