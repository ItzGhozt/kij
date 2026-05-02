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
    const deadline = Date.now() + 1500;

    function sendComplete() {
      if (pendingUpdates.current > 0 && Date.now() < deadline) {
        setTimeout(sendComplete, 50);
        return;
      }
      // Navigate back immediately — don't wait for HTTP response
      onBack();
      Api.completeGame(gameKey)
        .then((res) => {
          showToast(`Game completed! Winner: ${res.winner}`, 'success');
          onGamesChanged();
        })
        .catch((err) => {
          showToast(`Save failed: ${err.message}`, 'error');
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
        {/* Display working team once backend implements it */}
        {game.working_team && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Working Team: <strong>{game.working_team}</strong>
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

// ── Smart Pool Play Scoring with Card Layout ──────────────────────

function PoolPlayScoring({ teams, games, onGamesChanged, showToast }) {
  const [activeGameKey, setActiveGameKey] = useState(null);
  const [expandedPools, setExpandedPools] = useState({});

  const pools = [...new Set(Object.values(teams).map((t) => t.pool))].sort();

  function getPoolGames(pool) {
    // Get all scheduled games for this pool
    const poolGames = Object.entries(games)
      .filter(([, g]) => g.scheduled && g.pool === pool)
      .map(([gk, g]) => ({ key: gk, ...g }));

    // Sort: incomplete games first, then completed games
    poolGames.sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });

    return poolGames;
  }

  function togglePool(poolKey) {
    setExpandedPools(prev => ({ ...prev, [poolKey]: !prev[poolKey] }));
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
        const incompleteGames = poolGames.filter(g => !g.completed);
        const completedGames = poolGames.filter(g => g.completed);

        // Determine "Currently Playing" (first incomplete) and "Up Next" (second incomplete)
        const currentGame = incompleteGames[0];
        const nextGame = incompleteGames[1];
        const otherGames = incompleteGames.slice(2);

        return (
          <div key={pool} style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.3rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: 'var(--primary)'
            }}>
              Pool {pool}
            </h2>

            {poolGames.length === 0 ? (
              <div className="card">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No matchups scheduled. Ask an admin to generate the schedule.
                </p>
              </div>
            ) : (
              <>
                {/* Currently Playing */}
                {currentGame && (
                  <div 
                    className="card mb-3" 
                    style={{ 
                      border: '2px solid var(--primary)',
                      background: 'rgba(var(--primary-rgb), 0.05)'
                    }}
                  >
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      color: 'var(--primary)', 
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      ⚡ Currently Playing
                    </div>
                    <div style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '600', 
                      marginBottom: '0.5rem' 
                    }}>
                      🏐 {currentGame.team1} vs {currentGame.team2}
                    </div>
                    {currentGame.working_team && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-muted)', 
                        marginBottom: '0.75rem' 
                      }}>
                        Working: {currentGame.working_team}
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveGameKey(currentGame.key)}
                      style={{ width: '100%', fontSize: '1rem', padding: '0.75rem' }}
                    >
                      ⚡ Score This Game
                    </button>
                  </div>
                )}

                {/* Up Next */}
                {nextGame && (
                  <div className="card mb-3">
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      color: 'var(--text-muted)', 
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      ⏭️ Up Next
                    </div>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: '600', 
                      marginBottom: '0.5rem' 
                    }}>
                      {nextGame.team1} vs {nextGame.team2}
                    </div>
                    {nextGame.working_team && (
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-muted)', 
                        marginBottom: '0.75rem' 
                      }}>
                        Working: {nextGame.working_team}
                      </div>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => setActiveGameKey(nextGame.key)}
                      style={{ width: '100%' }}
                    >
                      Score This Match →
                    </button>
                  </div>
                )}

                {/* Other Incomplete Games - Collapsed */}
                {otherGames.length > 0 && (
                  <div className="card mb-3" style={{ padding: '0.75rem' }}>
                    <button
                      onClick={() => togglePool(`${pool}_incomplete`)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>▼ {otherGames.length} more game{otherGames.length > 1 ? 's' : ''} in queue</span>
                      <span>{expandedPools[`${pool}_incomplete`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedPools[`${pool}_incomplete`] && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {otherGames.map((game) => (
                          <div 
                            key={game.key}
                            style={{
                              padding: '0.75rem',
                              borderTop: '1px solid rgba(0,0,0,0.1)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                                {game.team1} vs {game.team2}
                              </div>
                              {game.working_team && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                  Working: {game.working_team}
                                </div>
                              )}
                            </div>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setActiveGameKey(game.key)}
                              style={{ minWidth: '80px', fontSize: '0.85rem' }}
                            >
                              Score
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completed Games - Collapsed */}
                {completedGames.length > 0 && (
                  <div className="card" style={{ padding: '0.75rem' }}>
                    <button
                      onClick={() => togglePool(`${pool}_completed`)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>✓ Completed Games ({completedGames.length})</span>
                      <span>{expandedPools[`${pool}_completed`] ? '▲' : '▼'}</span>
                    </button>
                    {expandedPools[`${pool}_completed`] && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {completedGames.map((game) => (
                          <div 
                            key={game.key}
                            style={{
                              padding: '0.75rem',
                              borderTop: '1px solid rgba(0,0,0,0.1)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '1rem'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>
                                {game.team1} vs {game.team2}
                              </div>
                              <div style={{ 
                                fontSize: '0.8rem', 
                                color: '#2d6a2d',
                                marginTop: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                flexWrap: 'wrap'
                              }}>
                                <span>Winner: {game.winner}</span>
                                {game.working_team && (
                                  <span style={{ color: 'var(--text-muted)' }}>• Working: {game.working_team}</span>
                                )}
                              </div>
                            </div>
                            <button
                              className="btn btn-secondary"
                              onClick={() => setActiveGameKey(game.key)}
                              style={{ minWidth: '80px', fontSize: '0.85rem' }}
                            >
                              View
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Manual game picker (unchanged) ────────────────────────────────

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

// ── Playoff scoring (unchanged) ───────────────────────────────────

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
  const isPoolPlay = !phase || phase === 'pool_play';

  return (
    <div className="container">
      <h1>Game Scoring</h1>

      <div style={{
        display: 'inline-block',
        marginBottom: '1.5rem',
        padding: '3px 14px',
        borderRadius: '12px',
        fontSize: '0.82rem',
        fontWeight: '600',
        background: isPoolPlay ? 'rgba(80,140,80,0.15)' : 'rgba(192,57,43,0.15)',
        color: isPoolPlay ? '#2d6a2d' : '#8b1a1a',
      }}>
        {isPoolPlay ? '🏐 Pool Play' : '🏆 Playoffs'}
      </div>

      {isPoolPlay ? (
        <PoolPlayScoring
          teams={teams}
          games={games}
          onGamesChanged={onGamesChanged}
          showToast={showToast}
        />
      ) : (
        <PlayoffScoring
          games={games}
          onGamesChanged={onGamesChanged}
          showToast={showToast}
        />
      )}
    </div>
  );
}