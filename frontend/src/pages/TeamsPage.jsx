import React, { useState, useEffect } from 'react';
import { Api } from '../api/http';

// ── Manual game picker (admin only) ──────────────────────────────

function ManualGamePicker({ teams, games, onGamesChanged, showToast }) {
  const teamNames = Object.keys(teams);
  const [team1, setTeam1] = useState(teamNames[0] || '');
  const [team2, setTeam2] = useState(teamNames[1] || '');
  const [activeGameKey, setActiveGameKey] = useState(null);

  const team2Options = teamNames.filter((n) => n !== team1);

  useEffect(() => {
    if (team2 === team1 && team2Options.length > 0) setTeam2(team2Options[0]);
  }, [team1]);

  // Sync defaults when teams load
  useEffect(() => {
    if (!team1 && teamNames.length > 0) setTeam1(teamNames[0]);
    if (!team2 && teamNames.length > 1) setTeam2(teamNames[1]);
  }, [teamNames.length]);

  function startGame() {
    if (!team1 || !team2 || team1 === team2) return;
    Api.createGame(team1, team2, 'pool_play')
      .then((res) => { setActiveGameKey(res.game_key); onGamesChanged(); })
      .catch((err) => showToast(err.message, 'error'));
  }

  if (activeGameKey) {
    // Just return to picker after game is started — scoring happens on Games page
    return (
      <div className="card mb-3">
        <p>
          Game started! Go to the <strong>Games</strong> page to score it.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => setActiveGameKey(null)}>
          Start Another
        </button>
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Manual Game</h3>
      <div className="grid-2 mb-2">
        <div className="form-group">
          <label>Team 1</label>
          <select className="form-control" value={team1} onChange={(e) => setTeam1(e.target.value)}>
            {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Team 2</label>
          <select className="form-control" value={team2} onChange={(e) => setTeam2(e.target.value)}>
            {team2Options.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={startGame} disabled={!team1 || !team2 || team1 === team2}>
        🌐 Start Game
      </button>
    </div>
  );
}

// ── Phase toggle (admin only) ─────────────────────────────────────

function PhaseControl({ phase, onPhaseChange, showToast, teams, games }) {
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  function switchPhase(newPhase) {
    if (newPhase === phase) return;
    setLoading(true);
    Api.setPhase(newPhase)
      .then(() => {
        onPhaseChange(newPhase);
        showToast(`Switched to ${newPhase === 'pool_play' ? 'Pool Play' : 'Playoffs'}`, 'success');
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function generateSchedule() {
    setScheduleLoading(true);
    Api.generateSchedule()
      .then((res) => {
        if (res.created === 0) {
          showToast('Schedule already generated — no new matchups added', 'success');
        } else {
          showToast(`Generated ${res.created} matchups`, 'success');
        }
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setScheduleLoading(false));
  }

  // Count scheduled games per pool
  const poolGames = {};
  Object.values(teams).forEach((t) => { poolGames[t.pool] = poolGames[t.pool] || 0; });
  Object.values(games).forEach((g) => {
    if (g.phase === 'pool_play' || !g.phase) {
      const pool = teams[g.team1]?.pool;
      if (pool) poolGames[pool] = (poolGames[pool] || 0) + 1;
    }
  });

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Tournament Phase</h3>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => switchPhase('pool_play')}
          disabled={loading}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '20px',
            border: '1px solid',
            cursor: 'pointer',
            fontWeight: '600',
            background: phase === 'pool_play' ? 'var(--primary)' : 'transparent',
            borderColor: phase === 'pool_play' ? 'var(--primary)' : 'rgba(0,0,0,0.2)',
            color: phase === 'pool_play' ? 'white' : 'inherit',
          }}
        >
          Pool Play
        </button>
        <button
          onClick={() => switchPhase('playoffs')}
          disabled={loading}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '20px',
            border: '1px solid',
            cursor: 'pointer',
            fontWeight: '600',
            background: phase === 'playoffs' ? '#c0392b' : 'transparent',
            borderColor: phase === 'playoffs' ? '#c0392b' : 'rgba(0,0,0,0.2)',
            color: phase === 'playoffs' ? 'white' : 'inherit',
          }}
        >
          Playoffs
        </button>
      </div>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '0.2rem' }}>Pool Play Schedule</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Auto-generates round-robin matchups within each pool. Skips duplicates.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={generateSchedule}
            disabled={scheduleLoading || Object.keys(teams).length === 0}
          >
            {scheduleLoading ? 'Generating...' : 'Generate Schedule'}
          </button>
        </div>

        {Object.entries(poolGames).sort().map(([pool, count]) => (
          <div key={pool} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '0.4rem 0.75rem', fontSize: '0.875rem',
            background: 'rgba(0,0,0,0.03)', borderRadius: '6px', marginBottom: '4px',
          }}>
            <span>Pool {pool}</span>
            <span style={{ color: 'var(--text-muted)' }}>{count} matchup{count !== 1 ? 's' : ''} scheduled</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team list ─────────────────────────────────────────────────────

function TeamList({ teams, admin, onDelete }) {
  const pools = ['A', 'B', 'C'];
  const byPool = {};
  pools.forEach((p) => { byPool[p] = []; });
  Object.entries(teams).forEach(([name, td]) => {
    const p = td.pool || 'A';
    if (!byPool[p]) byPool[p] = [];
    byPool[p].push([name, td]);
  });

  const activePools = pools.filter((p) => byPool[p].length > 0);
  if (activePools.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No teams registered yet.</p>;
  }

  return (
    <div>
      {activePools.map((pool) => (
        <div key={pool} className="card mb-3">
          <h3 style={{ marginBottom: '0.75rem' }}>Pool {pool}</h3>
          {byPool[pool].map(([name, td]) => (
            <div key={name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div>
                <div style={{ fontWeight: '500' }}>{name}</div>
                {(td.player1 || td.player2) && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {td.player1}{td.player1 && td.player2 ? ' & ' : ''}{td.player2}
                  </div>
                )}
              </div>
              {admin && (
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  onClick={() => onDelete(name)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Add team form ─────────────────────────────────────────────────

function AddTeamForm({ onAdd, showToast }) {
  const [teamName, setTeamName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [pool, setPool] = useState('A');
  const [loading, setLoading] = useState(false);

  // Auto-generate team name from player names
  function handlePlayerChange(p1, p2) {
    const last1 = p1.trim().split(' ').pop();
    const last2 = p2.trim().split(' ').pop();
    if (last1 && last2) setTeamName(`${last1}/${last2}`);
    else if (last1) setTeamName(last1);
  }

  function submit() {
    if (!teamName.trim()) { showToast('Team name required', 'error'); return; }
    setLoading(true);
    Api.createTeam({ team_name: teamName.trim(), player1: player1.trim(), player2: player2.trim(), pool })
      .then(() => {
        showToast(`Team "${teamName}" added to Pool ${pool}`, 'success');
        setTeamName(''); setPlayer1(''); setPlayer2(''); setPool('A');
        onAdd();
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="card mb-3">
      <h3 style={{ marginBottom: '1rem' }}>Add Team</h3>
      <div className="grid-2 mb-2">
        <div className="form-group">
          <label>Player 1</label>
          <input
            className="form-control"
            placeholder="First Last"
            value={player1}
            onChange={(e) => { setPlayer1(e.target.value); handlePlayerChange(e.target.value, player2); }}
          />
        </div>
        <div className="form-group">
          <label>Player 2</label>
          <input
            className="form-control"
            placeholder="First Last"
            value={player2}
            onChange={(e) => { setPlayer2(e.target.value); handlePlayerChange(player1, e.target.value); }}
          />
        </div>
      </div>
      <div className="grid-2 mb-2">
        <div className="form-group">
          <label>Team Name</label>
          <input
            className="form-control"
            placeholder="Auto-filled or custom"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Pool</label>
          <select className="form-control" value={pool} onChange={(e) => setPool(e.target.value)}>
            {['A', 'B', 'C', 'D', 'E'].map((p) => <option key={p} value={p}>Pool {p}</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={loading || !teamName.trim()}>
        {loading ? 'Adding...' : 'Add Team'}
      </button>
    </div>
  );
}

// ── Admin danger zone ─────────────────────────────────────────────

function DangerZone({ showToast, onReset }) {
  const [confirm, setConfirm] = useState(false);

  function doReset() {
    Api.resetTournament()
      .then(() => { showToast('Tournament reset', 'success'); onReset(); setConfirm(false); })
      .catch((err) => showToast(err.message, 'error'));
  }

  return (
    <div className="card mb-3" style={{ borderColor: 'rgba(200,50,50,0.3)' }}>
      <h3 style={{ marginBottom: '0.75rem', color: '#c0392b' }}>Danger Zone</h3>
      {!confirm ? (
        <button
          className="btn btn-danger"
          onClick={() => setConfirm(true)}
        >
          Reset All Tournament Data
        </button>
      ) : (
        <div>
          <p style={{ marginBottom: '0.75rem', fontWeight: '600' }}>
            This will delete ALL teams, games, and scores. Are you sure?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-danger" onClick={doReset}>Yes, Reset Everything</button>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TeamsPage ────────────────────────────────────────────────

export default function TeamsPage({ teams, games = {}, admin, authenticated, phase, onPhaseChange, onTeamsChanged, onGamesChanged, showToast }) {
  function deleteTeam(name) {
    Api.deleteTeam(name)
      .then(() => { showToast(`Removed ${name}`, 'success'); onTeamsChanged(); })
      .catch((err) => showToast(err.message, 'error'));
  }

  return (
    <div className="container">
      <h1>Team Management</h1>

      {admin && authenticated && (
        <>
          <PhaseControl
            phase={phase}
            onPhaseChange={onPhaseChange}
            showToast={showToast}
            teams={teams}
            games={games}
          />
          <AddTeamForm onAdd={onTeamsChanged} showToast={showToast} />
          <ManualGamePicker
            teams={teams}
            games={games}
            onGamesChanged={onGamesChanged || onTeamsChanged}
            showToast={showToast}
          />
        </>
      )}

      <TeamList teams={teams} admin={admin && authenticated} onDelete={deleteTeam} />

      {admin && authenticated && (
        <DangerZone showToast={showToast} onReset={onTeamsChanged} />
      )}

      {!admin && (
        <div className="card" style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.4)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Login as admin to manage teams and generate schedules.
          </p>
        </div>
      )}
    </div>
  );
}