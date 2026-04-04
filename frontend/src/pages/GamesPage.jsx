import { useState, useEffect } from 'react';
import { Api } from '../api/http';

// ── Score Game Panel ──────────────────────────────────────────────

function ScoreGamePanel({ teams, games, onGamesChanged, showToast }) {
  const teamNames = Object.keys(teams);
  const [team1, setTeam1] = useState(teamNames[0] || '');
  const [team2, setTeam2] = useState(teamNames[1] || '');
  const [gameKey, setGameKey] = useState(null);

  const team2Options = teamNames.filter((n) => n !== team1);

  useEffect(() => {
    if (team2 === team1 && team2Options.length > 0) setTeam2(team2Options[0]);
  }, [team1]);

  function startGame() {
    if (!team1 || !team2 || team1 === team2) return;
    Api.createGame(team1, team2)
      .then((res) => {
        setGameKey(res.game_key);
        onGamesChanged();
      })
      .catch((err) => showToast(err.message, 'error'));
  }

  function changeScore(setKey, team, delta) {
    Api.updateScore({ game_key: gameKey, set_key: setKey, team, delta }).then(onGamesChanged);
  }

  function finish() {
    Api.completeGame(gameKey).then((res) => {
      showToast(`Game completed! Winner: ${res.winner}`, 'success');
      setGameKey(null);
      onGamesChanged();
    });
  }

  const game = gameKey && games[gameKey];

  if (!gameKey) {
    return (
      <div>
        <h2>Live Game Scoring</h2>
        <div className="grid-2 mb-2">
          <div className="form-group">
            <label>Team 1</label>
            <select
              className="form-control"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
            >
              {teamNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Team 2</label>
            <select
              className="form-control"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
            >
              {team2Options.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={startGame}>
          🏐 Start Game
        </button>
      </div>
    );
  }

  if (!game) {
    return <div className="info-box">Loading game...</div>;
  }

  return (
    <div>
      <div className="match-header">
        <div className="vs-text">{game.team1}  vs  {game.team2}</div>
      </div>

      {[1, 2].map((setNum) => {
        const sk = `set${setNum}`;
        const s = game.sets[sk];
        return (
          <div key={sk}>
            <h3 className="text-center">Set {setNum}</h3>
            <div className="scoring-row">
              {/* Team 1 */}
              <div>
                <div className="score-card">
                  <div className="team-name">{game.team1}</div>
                  <div className="score-display">{s.team1_score}</div>
                </div>
                <div className="score-btn-row">
                  <button className="btn btn-primary btn-sm" onClick={() => changeScore(sk, 'team1', 1)}>➕ +1</button>
                  <button className="btn btn-sm" style={{ background: '#ccc' }} onClick={() => changeScore(sk, 'team1', -1)}>➖ -1</button>
                </div>
              </div>

              <div className="vs-text">VS</div>

              {/* Team 2 */}
              <div>
                <div className="score-card">
                  <div className="team-name">{game.team2}</div>
                  <div className="score-display">{s.team2_score}</div>
                </div>
                <div className="score-btn-row">
                  <button className="btn btn-primary btn-sm" onClick={() => changeScore(sk, 'team2', 1)}>➕ +1</button>
                  <button className="btn btn-sm" style={{ background: '#ccc' }} onClick={() => changeScore(sk, 'team2', -1)}>➖ -1</button>
                </div>
              </div>
            </div>
            <hr className="section-divider" />
          </div>
        );
      })}

      <div className="text-center mt-2">
        <button
          className="btn btn-primary"
          style={{ padding: '0.85rem 2.5rem' }}
          onClick={finish}
        >
          🏁 Complete Game
        </button>
      </div>
    </div>
  );
}

// ── Game History Panel ────────────────────────────────────────────

function GameHistoryPanel({ teams, games }) {
  const [openMap, setOpenMap] = useState({});

  const completed = Object.fromEntries(
    Object.entries(games).filter(([, g]) => g.completed)
  );

  if (Object.keys(completed).length === 0) {
    return <div className="info-box">No completed games to display.</div>;
  }

  const sections = { 'Pool A': [], 'Pool B': [], 'Pool C': [], 'Inter-Pool': [] };
  Object.entries(completed).forEach(([k, g]) => {
    const p1 = (teams[g.team1] || {}).pool || 'A';
    const p2 = (teams[g.team2] || {}).pool || 'A';
    if (p1 === p2) sections[`Pool ${p1}`].push({ key: k, game: g, p1, p2 });
    else sections['Inter-Pool'].push({ key: k, game: g, p1, p2 });
  });

  function toggle(k) {
    setOpenMap((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  return (
    <div>
      <h2>Completed Games</h2>
      {['Pool A', 'Pool B', 'Pool C', 'Inter-Pool'].map((sec) => {
        if (sections[sec].length === 0) return null;
        return (
          <div key={sec} className="mb-2">
            <h3>{sec} Games</h3>
            {sections[sec].map((item) => {
              const g = item.game;
              const isOpen = !!openMap[item.key];
              const title =
                `🏐 ${g.team1}${sec === 'Inter-Pool' ? ` (Pool ${item.p1})` : ''} vs ${g.team2}${sec === 'Inter-Pool' ? ` (Pool ${item.p2})` : ''}`;
              return (
                <div key={item.key} className={`game-history-item${isOpen ? ' open' : ''}`}>
                  <div className="game-history-header" onClick={() => toggle(item.key)}>
                    <span className="title">{title}</span>
                    <span className="winner-badge">🏆 {g.winner}</span>
                    <span className="chevron">▼</span>
                  </div>
                  <div className="game-history-body">
                    {[1, 2].map((sn) => {
                      const sk = `set${sn}`;
                      const s = g.sets[sk];
                      return (
                        <div key={sk} className="set-line">
                          Set {sn}: {g.team1} {s.team1_score} – {g.team2} {s.team2_score}
                        </div>
                      );
                    })}
                    {g.start_time && <div className="meta">Started: {new Date(g.start_time).toLocaleString()}</div>}
                    {g.end_time && <div className="meta">Completed: {new Date(g.end_time).toLocaleString()}</div>}
                    <div className="meta">{g.team1}: Pool {item.p1}  |  {g.team2}: Pool {item.p2}</div>
                  </div>
                </div>
              );
            })}
            <hr className="section-divider" />
          </div>
        );
      })}
    </div>
  );
}

// ── Games Page ────────────────────────────────────────────────────

export default function GamesPage({ teams, games, onGamesChanged, onNav, showToast }) {
  const [tab, setTab] = useState('score');
  const teamNames = Object.keys(teams);

  if (teamNames.length < 2) {
    return (
      <div>
        <h1>Game Scoring</h1>
        <div className="info-box">You need at least 2 teams to create games.</div>
        <button className="btn btn-primary mt-1" onClick={() => onNav('teams')}>
          Go to Teams
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Game Scoring</h1>
      <div className="flex-row mb-2">
        <button
          className={`btn btn-sm ${tab === 'score' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('score')}
        >
          🎮 Score Game
        </button>
        <button
          className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('history')}
        >
          📋 Game History
        </button>
      </div>
      {tab === 'score' ? (
        <ScoreGamePanel
          teams={teams}
          games={games}
          onGamesChanged={onGamesChanged}
          showToast={showToast}
        />
      ) : (
        <GameHistoryPanel teams={teams} games={games} />
      )}
    </div>
  );
}
