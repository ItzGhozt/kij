import { useState } from 'react';
import { Api } from '../api/http';

export default function TeamsPage({ teams, admin, authenticated, onTeamsChanged, showToast }) {
  const [teamName, setTeamName] = useState('');
  const [pool, setPool] = useState('A');
  const [confirmReset, setConfirmReset] = useState(false);

  const isAdmin = admin && authenticated;

  function registerTeam(e) {
    e.preventDefault();
    if (!teamName.trim()) return;
    Api.createTeam({ team_name: teamName.trim(), pool })
      .then(() => {
        showToast(`Team "${teamName.trim()}" registered!`, 'success');
        setTeamName('');
        onTeamsChanged();
      })
      .catch((err) => showToast(err.message, 'error'));
  }

  function deleteTeam(name) {
    if (!confirm(`Delete team "${name}"?`)) return;
    Api.deleteTeam(name)
      .then(() => {
        showToast('Team deleted', 'success');
        onTeamsChanged();
      })
      .catch((err) => showToast(err.message, 'error'));
  }

  function doReset() {
    Api.resetTournament()
      .then(() => {
        showToast('Tournament reset!', 'success');
        setConfirmReset(false);
        onTeamsChanged();
      })
      .catch((err) => showToast(err.message, 'error'));
  }

  // Group by pool
  const pools = { A: [], B: [], C: [] };
  Object.keys(teams).forEach((name) => {
    const p = teams[name].pool || 'A';
    if (!pools[p]) pools[p] = [];
    pools[p].push(name);
  });

  return (
    <div>
      <h1>Team Management</h1>

      {isAdmin && (
        <div>
          <h2>📋 Admin View – All Teams</h2>

          {/* Reset */}
          <details className="card" style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--red-admin)' }}>
              ⚠️ Tournament Reset
            </summary>
            <p className="mt-1" style={{ fontSize: '0.9rem' }}>
              This will delete ALL teams and games. This cannot be undone!
            </p>
            {!confirmReset ? (
              <button
                className="btn btn-danger btn-sm mt-1"
                onClick={() => setConfirmReset(true)}
              >
                🗑️ Reset Tournament
              </button>
            ) : (
              <div className="mt-1 flex-row">
                <button className="btn btn-danger btn-sm" onClick={doReset}>
                  ✅ Yes, Reset
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#ccc' }}
                  onClick={() => setConfirmReset(false)}
                >
                  ❌ Cancel
                </button>
              </div>
            )}
          </details>

          {/* Register form */}
          <div className="card">
            <h3>🆕 Register New Team</h3>
            {Object.keys(teams).length >= 15 ? (
              <div className="info-box">Maximum of 15 teams reached!</div>
            ) : (
              <form onSubmit={registerTeam}>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Team Name</label>
                    <input
                      className="form-control"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter team name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Pool</label>
                    <select
                      className="form-control"
                      value={pool}
                      onChange={(e) => setPool(e.target.value)}
                    >
                      <option value="A">Pool A</option>
                      <option value="B">Pool B</option>
                      <option value="C">Pool C</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-secondary mt-1" type="submit">
                  Register Team
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Teams by pool */}
      {Object.keys(teams).length === 0 ? (
        <div className="info-box mt-2">No teams have been registered yet.</div>
      ) : (
        <div className="mt-2">
          <h2>Registered Teams by Pool</h2>
          {['A', 'B', 'C'].map((p) => {
            if (!pools[p] || pools[p].length === 0) return null;
            return (
              <div key={p} className="mb-2">
                <h3>🏊 Pool {p}</h3>
                <div className="grid-3">
                  {pools[p].map((name) => (
                    <div key={name} className="team-card">
                      <div className="team-name">🏐 {name}</div>
                      <div className="pool-label">Pool {p}</div>
                      {isAdmin && (
                        <button
                          className="delete-btn"
                          title="Delete team"
                          onClick={() => deleteTeam(name)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
