import React, { useState, useEffect, useRef } from 'react';
import { Api } from '../api/http';

// ── Shared scoring UI ─────────────────────────────────────────────

function ScoringView({ gameKey, games, onGamesChanged, showToast, onBack }) {
  const [localScores, setLocalScores] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const pendingUpdates = useRef(0);
  const serverGame = gameKey && games[gameKey];

  useEffect(() => {
    if (serverGame && !localScores) {
      setLocalScores(JSON.parse(JSON.stringify(serverGame.sets)));
    }
  }, [games, gameKey]);

  function changeScore(setKey, team, delta) {
    if (finishing) return;
    const scoreField = `${team}_score`;
    setLocalScores((prev) => {
      const cur = prev[setKey][scoreField];
      return { ...prev, [setKey]: { ...prev[setKey], [scoreField]: Math.max(0, cur + delta) } };
    });
    pendingUpdates.current += 1;
    Api.updateScore({ game_key: gameKey, set_key: setKey, team, delta })
      .catch(() => {
        setLocalScores((prev) => {
          const cur = prev[setKey][scoreField];
          return { ...prev, [setKey]: { ...prev[setKey], [scoreField]: Math.max(0, cur - delta) } };
        });
        showToast('Score update failed', 'error');
      })
      .finally(() => {
        pendingUpdates.current -= 1;
      });
  }

  function finish() {
    setFinishing(true);

    function sendComplete() {
      if (pendingUpdates.current > 0) {
        setTimeout(sendComplete, 50);
        return;
      }
      Api.completeGame(gameKey)
        .then((res) => {
          showToast(`Game completed! Winner: ${res.winner}`, 'success');
          onBack();
          onGamesChanged();
        })
        .catch((err) => {
          showToast(err.message, 'error');
          setFinishing(false);
        });
    }

    sendComplete();
  }

  if (!serverGame) return <p>Game not found.</p>;

  const game = { ...serverGame, sets: localScores || serverGame.sets };

  return (
    <div>
      <button className="btn btn-secondary mb-2" onClick={onBack}>← Back to matchups</button>
      <div className="card mb-3" style={{ textAlign: 'center', padding: '1.5rem' }}>
        <h2>{game.team1} vs {game.team2}</h2>
        {game.completed && (
          <div style={{ marginTop: '0.5rem' }}>
            <span className="badge badge-success">Completed — Winner: {game.winner}</span>
          </div>
        )}
      </div>

      {Object.entries(game.sets).map(([setKey, scores]) => (
        <div key={setKey} className="card mb-3">
          <h3 style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            {setKey.replace('set', 'Set ')}
          </h3>
          <div className="scoring-grid">
            {/* Team 1 */}
            <div>
              <div className="score-display">
                <div className="team-label">{game.team1}</div>
                <div className="score-number">{scores.team1_score}</div>
              </div>
              {!game.completed && (
                <div className="score-buttons">
                  <button className="btn btn-success" disabled={finishing} onClick={() => changeScore(setKey, 'team1', 1)}>+1</button>
                  <button className="btn btn-secondary" disabled={finishing} onClick={() => changeScore(setKey, 'team1', -1)}>−1</button>
                </div>
              )}
            </div>

            {/* VS */}
            <div className="vs-separator">VS</div>

            {/* Team 2 */}
            <div>
              <div className="score-display">
                <div className="team-label">{game.team2}</div>
                <div className="score-number">{scores.team2_score}</div>
              </div>
              {!game.completed && (
                <div className="score-buttons">
                  <button className="btn btn-success" disabled={finishing} onClick={() => changeScore(setKey, 'team2', 1)}>+1</button>
                  <button className="btn btn-secondary" disabled={finishing} onClick={() => changeScore(setKey, 'team2', -1)}>−1</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {!game.completed && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            className="btn btn-primary"
            onClick={finish}
            disabled={finishing}
            style={{ minWidth: '160px' }}
          >
            {finishing ? 'Saving...' : 'Complete Game'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pool play matchup dropdowns ───────────────────────────────────

function PoolPlayScoring({ teams, games, onGamesChanged, showToast }) {
  const [activeGameKey, setActiveGameKey] = useState(null);
  const [selections, setSelections] = useState({});

  const pools = [...new Set(Object.values(teams).map((t) => t.pool))].sort();

  function getPoolGames(pool) {
    const poolTeamSet = new Set(
      Object.entries(teams).filter(([, td]) => td.pool === pool).map(([name]) => name)
    );
    return Object.entries(games).filter(
      ([, g]) => g.scheduled && poolTeamSet.has(g.team1) && poolTeamSet.has(g.team2)
    );
  }

  if (activeGameKey) {
    return (
      <ScoringView
        gameKey={activeGameKey}
        games={games}
        onGamesChanged={onGamesChanged}
        showToast={showToast}
        onBack={() => setActiveGameKey(null)}
      />
    );
  }

  if (pools.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-muted)' }}>No teams registered yet.</p>
      </div>
    );
  }

  return (
    <div>
      {pools.map((pool) => {
        const poolGames = getPoolGames(pool);
        const selected = selections[pool] || '';
        return (
          <div key={pool} className="card mb-3">
            <h3 style={{ marginBottom: '1rem' }}>Pool {pool}</h3>
            {poolGames.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No matchups scheduled. Ask an admin to generate the schedule.
              </p>
            ) : (
              <>
                <div className="form-group mb-2">
                  <label>Select Matchup</label>
                  <select
                    className="form-control"
                    value={selected}
                    onChange={(e) => setSelections((prev) => ({ ...prev, [pool]: e.target.value }))}
                  >
                    <option value="">— Select a matchup —</option>
                    {poolGames.map(([gk, g]) => (
                      <option key={gk} value={gk}>
                        {g.team1} vs {g.team2}{g.completed ? '  ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!selected}
                  onClick={() => setActiveGameKey(selected)}
                >
                  🏐 Score Match
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Manual game picker ────────────────────────────────────────────

function ManualGamePicker({ teams, games, onGamesChanged, showToast }) {
  const teamNames = Object.keys(teams);
  const [team1, setTeam1] = useState(teamNames[0] || '');
  const [team2, setTeam2] = useState(teamNames[1] || '');
  const [activeGameKey, setActiveGameKey] = useState(null);

  const team2Options = teamNames.filter((n) => n !== team1);

  useEffect(() => {
    if (team2 === team1 && team2Options.length > 0) setTeam2(team2Options[0]);
  }, [team1]);

  function startGame() {
    if (!team1 || !team2 || team1 === team2) return;
    Api.createGame(team1, team2, 'pool_play')
      .then((res) => { setActiveGameKey(res.game_key); onGamesChanged(); })
      .catch((err) => showToast(err.message, 'error'));
  }

  if (activeGameKey) {
    return (
      <ScoringView
        gameKey={activeGameKey}
        games={games}
        onGamesChanged={onGamesChanged}
        showToast={showToast}
        onBack={() => setActiveGameKey(null)}
      />
    );
  }

  return (
    <div>
      <h2 className="section-title">Live Game Scoring</h2>
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
      <button className="btn btn-primary" onClick={startGame} disabled={!team1 || !team2}>
        Start Game
      </button>
    </div>
  );
}

// ── Game History ──────────────────────────────────────────────────

function GameHistory({ games, teams }) {
  const completed = Object.entries(games).filter(([, g]) => g.completed);
  if (completed.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No completed games yet.</p>;
  }
  return (
    <div>
      <h2 className="section-title">Game History</h2>
      {completed.map(([gk, g]) => (
        <div key={gk} className="card mb-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600' }}>{g.team1} vs {g.team2}</span>
            <span style={{
              fontSize: '0.8rem', padding: '2px 10px', borderRadius: '12px',
              background: 'rgba(80,160,80,0.15)', color: '#2d6a2d',
            }}>
              {g.winner}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {Object.entries(g.sets).map(([sk, s]) => (
              <span key={sk}>{sk.replace('set', 'S')}: {s.team1_score}–{s.team2_score}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Playoff scoring ───────────────────────────────────────────────

function PlayoffScoring({ games, onGamesChanged, showToast }) {
  const [activeGameKey, setActiveGameKey] = useState(null);

  const playoffGames = Object.entries(games).filter(([, g]) => !g.scheduled);

  if (activeGameKey) {
    return (
      <ScoringView
        gameKey={activeGameKey}
        games={games}
        onGamesChanged={onGamesChanged}
        showToast={showToast}
        onBack={() => setActiveGameKey(null)}
      />
    );
  }

  if (playoffGames.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'var(--text-muted)' }}>
          No playoff games yet. Add a game from the Admin panel.
        </p>
      </div>
    );
  }

  return (
    <div>
      {playoffGames.map(([gk, g]) => (
        <div key={gk} className="card mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '600' }}>{g.team1} vs {g.team2}</div>
            {g.completed && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Winner: {g.winner}
              </div>
            )}
          </div>
          <button
            className={`btn ${g.completed ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => setActiveGameKey(gk)}
          >
            {g.completed ? 'View' : '🏐 Score'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main GamesPage ────────────────────────────────────────────────

export default function GamesPage({ teams, games, phase, onGamesChanged, showToast }) {
  const [tab, setTab] = useState('score');

  const isPoolPlay = !phase || phase === 'pool_play';

  return (
    <div className="container">
      <h1>Game Scoring</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { key: 'pool_play', label: '🏐 Pool Play', activeColor: 'var(--primary)' },
          { key: 'playoffs',  label: '🏆 Playoffs',  activeColor: '#c0392b' },
        ].map(({ key, label, activeColor }) => {
          const active = phase === key || (key === 'pool_play' && isPoolPlay);
          return (
            <div key={key} style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '20px',
              border: `1px solid ${active ? activeColor : 'rgba(0,0,0,0.15)'}`,
              fontWeight: active ? '700' : '400',
              fontSize: '0.9rem',
              background: active ? activeColor : 'transparent',
              color: active ? 'white' : 'var(--text-muted)',
              userSelect: 'none',
            }}>
              {label}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'score', label: '🎮 Score Game' },
          { key: 'history', label: '📜 Game History' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '20px',
              border: '1px solid',
              cursor: 'pointer',
              fontWeight: tab === key ? '600' : '400',
              background: tab === key ? 'var(--primary)' : 'transparent',
              borderColor: tab === key ? 'var(--primary)' : 'rgba(0,0,0,0.2)',
              color: tab === key ? 'white' : 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'score' && isPoolPlay && (
        <PoolPlayScoring
          teams={teams}
          games={games}
          onGamesChanged={onGamesChanged}
          showToast={showToast}
        />
      )}
      {tab === 'score' && !isPoolPlay && (
        <PlayoffScoring
          games={games}
          onGamesChanged={onGamesChanged}
          showToast={showToast}
        />
      )}
      {tab === 'history' && (
        <GameHistory games={games} teams={teams} />
      )}
    </div>
  );
}