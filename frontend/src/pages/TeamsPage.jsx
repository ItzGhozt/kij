import React, { useState, useEffect } from 'react';
import { Api } from '../api/http';

// ── Manual Game Picker ────────────────────────────────────────────

function ManualGamePicker({ teams, onGamesChanged, showToast }) {
  const teamNames = Object.keys(teams);
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [started, setStarted] = useState(false);

  const team2Options = teamNames.filter((n) => n !== team1);

  useEffect(() => {
    if (teamNames.length > 0 && !team1) setTeam1(teamNames[0]);
    if (teamNames.length > 1 && !team2) setTeam2(teamNames[1]);
  }, [teamNames.length]);

  useEffect(() => {
    if (team2 === team1 && team2Options.length > 0) setTeam2(team2Options[0]);
  }, [team1]);

  function startGame() {
    if (!team1 || !team2 || team1 === team2) return;
    Api.createGame(team1, team2, 'pool_play')
      .then(() => { onGamesChanged(); setStarted(true); })
      .catch((err) => showToast(err.message, 'error'));
  }

  if (started) {
    return (
      <div className="card mb-3">
        <p style={{ marginBottom: '0.75rem' }}>✅ Game created! Score it on the <strong>Games</strong> page.</p>
        <button className="btn btn-secondary" onClick={() => setStarted(false)}>Start Another</button>
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Start a Manual Game</h3>
      <div className="form-group mb-2">
        <label>Team 1</label>
        <select className="form-control" value={team1} onChange={(e) => setTeam1(e.target.value)}>
          {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="form-group mb-2">
        <label>Team 2</label>
        <select className="form-control" value={team2} onChange={(e) => setTeam2(e.target.value)}>
          {team2Options.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={startGame} disabled={!team1 || !team2 || team1 === team2}>
        🌐 Start Game
      </button>
    </div>
  );
}

// ── Tournament Phase + Schedule ───────────────────────────────────

function PhaseControl({ phase, onPhaseChange, showToast, teams, games }) {
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  function switchPhase(newPhase) {
    if (newPhase === phase) return;
    setLoading(true);
    Api.setPhase(newPhase)
      .then(() => { onPhaseChange(newPhase); showToast(`Switched to ${newPhase === 'pool_play' ? 'Pool Play' : 'Playoffs'}`, 'success'); })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function generateSchedule() {
    setScheduleLoading(true);
    Api.generateSchedule()
      .then((res) => showToast(res.created === 0 ? 'Schedule already up to date' : `Generated ${res.created} matchups`, 'success'))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setScheduleLoading(false));
  }

  const poolCounts = {};
  Object.values(teams).forEach((t) => { poolCounts[t.pool] = poolCounts[t.pool] || 0; });
  Object.values(games).forEach((g) => {
    const pool = teams[g.team1]?.pool;
    if (pool) poolCounts[pool] = (poolCounts[pool] || 0) + 1;
  });

  return (
    <>
      <div className="card mb-3">
        <h3 style={{ marginBottom: '1rem' }}>Tournament Phase</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {['pool_play', 'playoffs'].map((p) => {
            const label = p === 'pool_play' ? 'Pool Play' : 'Playoffs';
            const active = phase === p;
            const color = p === 'playoffs' ? '#c0392b' : 'var(--primary)';
            return (
              <button key={p} onClick={() => switchPhase(p)} disabled={loading} style={{
                padding: '0.5rem 1.5rem', borderRadius: '20px', border: '1px solid',
                cursor: 'pointer', fontWeight: '600',
                background: active ? color : 'transparent',
                borderColor: active ? color : 'rgba(0,0,0,0.2)',
                color: active ? 'white' : 'inherit',
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card mb-3">
        <h3 style={{ marginBottom: '0.5rem' }}>Schedule</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Auto-generates round-robin matchups per pool. Safe to re-run — skips existing games.
        </p>
        <button
          className="btn btn-primary"
          onClick={generateSchedule}
          disabled={scheduleLoading || Object.keys(teams).length === 0}
          style={{ marginBottom: '1rem' }}
        >
          {scheduleLoading ? 'Generating...' : '📅 Generate Schedule'}
        </button>
        {Object.entries(poolCounts).sort().map(([pool, count]) => (
          <div key={pool} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '0.4rem 0.75rem', fontSize: '0.875rem',
            background: 'rgba(0,0,0,0.03)', borderRadius: '6px', marginBottom: '4px',
          }}>
            <span>Pool {pool}</span>
            <span style={{ color: 'var(--text-muted)' }}>{count} matchup{count !== 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Add Team ──────────────────────────────────────────────────────

function AddTeamForm({ onAdd, showToast }) {
  const [teamName, setTeamName] = useState('');
  const [pool, setPool] = useState('A');
  const [loading, setLoading] = useState(false);

  function submit() {
    if (!teamName.trim()) { showToast('Team name required', 'error'); return; }
    setLoading(true);
    Api.createTeam({ team_name: teamName.trim(), player1: '', player2: '', pool })
      .then(() => { showToast(`"${teamName}" added to Pool ${pool}`, 'success'); setTeamName(''); setPool('A'); onAdd(); })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Add Team</h3>
      <div className="form-group mb-2">
        <label>Team Name</label>
        <input
          className="form-control"
          placeholder="e.g. Smith/Jones"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="form-group mb-2">
        <label>Pool</label>
        <select className="form-control" value={pool} onChange={(e) => setPool(e.target.value)}>
          {['A', 'B', 'C', 'D', 'E'].map((p) => <option key={p} value={p}>Pool {p}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={loading || !teamName.trim()}>
        {loading ? 'Adding...' : '+ Add Team'}
      </button>
    </div>
  );
}

// ── Registered Teams ──────────────────────────────────────────────

function TeamList({ teams, onDelete }) {
  const pools = ['A', 'B', 'C', 'D', 'E'];
  const byPool = {};
  Object.entries(teams).forEach(([name, td]) => {
    const p = td.pool || 'A';
    if (!byPool[p]) byPool[p] = [];
    byPool[p].push(name);
  });
  const activePools = pools.filter((p) => byPool[p]?.length > 0);

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Registered Teams</h3>
      {activePools.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No teams yet.</p>
      ) : activePools.map((pool) => (
        <div key={pool} style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>
            POOL {pool}
          </div>
          {byPool[pool].map((name) => (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.4rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}>
              <span style={{ fontWeight: '500' }}>{name}</span>
              <button className="btn btn-danger" style={{ fontSize: '0.78rem', padding: '3px 10px' }} onClick={() => onDelete(name)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Reset Tournament ──────────────────────────────────────────────

function ResetTournament({ showToast, onReset }) {
  const [confirm, setConfirm] = useState(false);

  function doReset() {
    Api.resetTournament()
      .then(() => { showToast('Tournament reset', 'success'); onReset(); setConfirm(false); })
      .catch((err) => showToast(err.message, 'error'));
  }

  return (
    <div className="card mb-3" style={{ borderColor: 'rgba(200,50,50,0.3)' }}>
      <h3 style={{ marginBottom: '0.75rem', color: '#c0392b' }}>Reset Tournament</h3>
      {!confirm ? (
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>Reset All Data</button>
      ) : (
        <div>
          <p style={{ marginBottom: '0.75rem', fontWeight: '600', fontSize: '0.9rem' }}>
            Deletes ALL teams, games, and scores. Cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-danger" onClick={doReset}>Yes, Reset</button>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TeamsPage ────────────────────────────────────────────────

export default function TeamsPage({ teams, games = {}, admin, authenticated, phase, onPhaseChange, onTeamsChanged, onGamesChanged, showToast }) {
  const [activePanel, setActivePanel] = useState('tournament');

  function deleteTeam(name) {
    Api.deleteTeam(name)
      .then(() => { showToast(`Removed ${name}`, 'success'); onTeamsChanged(); })
      .catch((err) => showToast(err.message, 'error'));
  }

  if (!admin || !authenticated) {
    return (
      <div className="container">
        <h1>Admin Panel</h1>
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>Login as admin to manage the tournament.</p>
        </div>
      </div>
    );
  }

  const panels = [
    { key: 'tournament', label: '🏐 Tournament' },
    { key: 'teams',      label: '👥 Teams' },
  ];

  return (
    <div className="container">
      <h1>Admin Panel</h1>

      {/* Panel switcher */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {panels.map(({ key, label }) => {
          const active = activePanel === key;
          return (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              style={{
                flex: 1,
                padding: '1rem',
                borderRadius: '12px',
                border: `2px solid ${active ? 'var(--primary)' : 'rgba(0,0,0,0.1)'}`,
                background: active ? 'var(--primary)' : 'rgba(255,255,255,0.5)',
                color: active ? 'white' : 'inherit',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Panel 1: Tournament controls */}
      {activePanel === 'tournament' && (
        <div>
          <PhaseControl
            phase={phase}
            onPhaseChange={onPhaseChange}
            showToast={showToast}
            teams={teams}
            games={games}
          />
          <ManualGamePicker
            teams={teams}
            onGamesChanged={onGamesChanged || onTeamsChanged}
            showToast={showToast}
          />
        </div>
      )}

      {/* Panel 2: Team management */}
      {activePanel === 'teams' && (
        <div>
          <AddTeamForm onAdd={onTeamsChanged} showToast={showToast} />
          <TeamList teams={teams} onDelete={deleteTeam} />
          <ResetTournament showToast={showToast} onReset={onTeamsChanged} />
        </div>
      )}
    </div>
  );
}