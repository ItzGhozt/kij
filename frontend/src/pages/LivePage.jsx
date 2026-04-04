import { useState, useEffect } from 'react';
import { Api } from '../api/http';

export default function LivePage({ teams, games, onRefresh }) {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    Api.getStandings().then(setStandings).catch(() => {});
  }, [games]);

  const active = Object.fromEntries(
    Object.entries(games).filter(([, g]) => !g.completed)
  );

  return (
    <div>
      <h1>
        <span className="live-dot" /> LIVE TOURNAMENT SCOREBOARD
      </h1>
      <p style={{ color: 'var(--gray-sub)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Real-time updates via WebSocket — scores refresh automatically!
      </p>
      <div className="text-center mb-2">
        <button className="btn btn-primary btn-sm" onClick={onRefresh}>
          🔄 Refresh Scores
        </button>
      </div>

      {/* Active games */}
      <h2>⚡ LIVE GAMES</h2>
      {Object.keys(active).length === 0 ? (
        <div className="info-box">No games currently in progress.</div>
      ) : (
        <LiveGames active={active} teams={teams} />
      )}

      <hr className="section-divider" />

      {/* Standings */}
      <h2>🏆 TOURNAMENT STANDINGS</h2>
      {standings.length === 0 ? (
        <div className="info-box">
          No games completed yet — standings will appear after games are played.
        </div>
      ) : (
        <table className="standings-table">
          <thead>
            <tr>
              {['#', 'Team', 'Pool', 'Games', 'Set W', 'Set L', 'Pt Diff'].map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const diff = s.point_differential;
              const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
              return (
                <tr key={s.team}>
                  <td>#{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s.team}</td>
                  <td>{s.pool}</td>
                  <td>{s.games_played}</td>
                  <td>{s.set_wins}</td>
                  <td>{s.set_losses}</td>
                  <td
                    style={{
                      color: diff > 0 ? 'var(--green-leaf)' : diff < 0 ? 'var(--red-admin)' : 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    {diffStr}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LiveGames({ active, teams }) {
  const sections = { A: [], B: [], C: [], 'Inter-Pool': [] };

  Object.entries(active).forEach(([k, g]) => {
    const p1 = (teams[g.team1] || {}).pool || 'A';
    const p2 = (teams[g.team2] || {}).pool || 'A';
    if (p1 === p2) sections[p1].push({ key: k, game: g, p1, p2 });
    else sections['Inter-Pool'].push({ key: k, game: g, p1, p2 });
  });

  return (
    <div>
      {['A', 'B', 'C', 'Inter-Pool'].map((sec) => {
        if (sections[sec].length === 0) return null;
        const heading = sec === 'Inter-Pool' ? '🔥 Inter-Pool Games — LIVE' : `🏊 Pool ${sec} — LIVE`;
        return (
          <div key={sec} className="mb-2">
            <h3>{heading}</h3>
            {sections[sec].map((item) => {
              const g = item.game;
              return (
                <div key={item.key} className="live-game-card">
                  <div className="scoring-row" style={{ marginBottom: 0 }}>
                    <div className="score-card">
                      <div className="team-name">{g.team1}</div>
                      {sec === 'Inter-Pool' && <div className="pool-label">Pool {item.p1}</div>}
                    </div>
                    <div className="vs-text">VS</div>
                    <div className="score-card">
                      <div className="team-name">{g.team2}</div>
                      {sec === 'Inter-Pool' && <div className="pool-label">Pool {item.p2}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.92rem', color: 'var(--gray-sub)' }}>
                    {[1, 2].map((sn) => {
                      const sk = `set${sn}`;
                      const s = g.sets[sk];
                      return (
                        <span key={sk} style={{ fontWeight: 500 }}>
                          Set {sn}: {s.team1_score} – {s.team2_score}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
