import { useState, useEffect } from 'react';
import { Api } from '../api/http';

// A game is "active" (being scored) if it's not completed and has at least one point scored
function isActive(game) {
  if (game.completed) return false;
  return Object.values(game.sets).some(
    (s) => (s.team1_score || 0) + (s.team2_score || 0) > 0
  );
}

// For each pool, return the single active game (if any)
function getActiveByPool(games, teams) {
  const byPool = {};
  Object.entries(games).forEach(([key, g]) => {
    if (!isActive(g)) return;
    const pool = teams[g.team1]?.pool || teams[g.team2]?.pool || '?';
    if (!byPool[pool]) byPool[pool] = { key, game: g, pool };
  });
  return byPool;
}

// ── Single live game card ─────────────────────────────────────────

function LiveGameCard({ gk, game }) {
  const sets = Object.entries(game.sets);

  let t1Sets = 0, t2Sets = 0;
  sets.forEach(([, s]) => {
    if (s.team1_score > s.team2_score) t1Sets++;
    else if (s.team2_score > s.team1_score) t2Sets++;
  });

  return (
    <div style={{
      background: 'rgba(255,255,255,0.75)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
      border: '1px solid rgba(255,255,255,0.3)',
    }}>

      {/* Team names */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 3.5vw, 1.3rem)', fontWeight: 700, color: 'var(--green-deep)', textAlign: 'center', wordBreak: 'break-word' }}>
          {game.team1}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-sub)', textAlign: 'center' }}>
          VS
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 3.5vw, 1.3rem)', fontWeight: 700, color: 'var(--green-deep)', textAlign: 'center', wordBreak: 'break-word' }}>
          {game.team2}
        </div>
      </div>

      {/* Set scores — big, prominent */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {sets.map(([sk, s]) => {
          const t1Winning = s.team1_score > s.team2_score;
          const t2Winning = s.team2_score > s.team1_score;
          return (
            <div key={sk} style={{
              background: 'rgba(164,184,124,0.12)',
              borderRadius: '12px',
              padding: '0.75rem 1.5rem',
              textAlign: 'center',
              minWidth: '130px',
              flex: 1,
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-sub)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {sk.replace('set', 'Set ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: 'clamp(2.2rem, 8vw, 3rem)', fontWeight: 800, fontFamily: 'var(--font-display)', color: t1Winning ? 'var(--green-leaf)' : 'var(--gray-text)', lineHeight: 1 }}>
                  {s.team1_score}
                </span>
                <span style={{ fontSize: '1.2rem', color: 'var(--gray-sub)', fontWeight: 300 }}>–</span>
                <span style={{ fontSize: 'clamp(2.2rem, 8vw, 3rem)', fontWeight: 800, fontFamily: 'var(--font-display)', color: t2Winning ? 'var(--green-leaf)' : 'var(--gray-text)', lineHeight: 1 }}>
                  {s.team2_score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sets won — smaller, below */}
      <div style={{
        borderTop: '1px solid rgba(0,0,0,0.07)',
        paddingTop: '0.75rem',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '0.5rem',
        textAlign: 'center',
      }}>
        <div>
          <span style={{ fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', fontWeight: 800, fontFamily: 'var(--font-display)', color: t1Sets > t2Sets ? 'var(--green-leaf)' : 'var(--gray-sub)' }}>
            {t1Sets}
          </span>
          <div style={{ fontSize: '0.7rem', color: 'var(--gray-sub)' }}>sets won</div>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--gray-sub)', fontWeight: 600 }}>SETS</div>
        <div>
          <span style={{ fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', fontWeight: 800, fontFamily: 'var(--font-display)', color: t2Sets > t1Sets ? 'var(--green-leaf)' : 'var(--gray-sub)' }}>
            {t2Sets}
          </span>
          <div style={{ fontSize: '0.7rem', color: 'var(--gray-sub)' }}>sets won</div>
        </div>
      </div>

    </div>
  );
}

// ── Main LivePage ─────────────────────────────────────────────────

export default function LivePage({ teams, games, onRefresh }) {
  const [standings, setStandings] = useState([]);

  useEffect(() => {
    Api.getStandings().then(setStandings).catch(() => {});
  }, [games]);

  const activeByPool = getActiveByPool(games, teams);
  const activePools = Object.keys(activeByPool).sort();

  return (
    <div className="container">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="live-dot" /> Live Scores
      </h1>

      {activePools.length === 0 ? (
        <div className="info-box mb-3">
          No games currently in progress. Scores appear here automatically once scoring starts.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {activePools.map((pool) => {
            const { key, game } = activeByPool[pool];
            return (
              <div key={key}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginBottom: '0.6rem',
                  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                  color: '#2d5a2d',
                  background: 'rgba(80,140,80,0.12)',
                  border: '1px solid rgba(80,140,80,0.25)',
                  borderRadius: '20px', padding: '3px 12px',
                }}>
                  <span className="live-dot" style={{ width: 7, height: 7, margin: 0 }} />
                  POOL {pool} — LIVE
                </div>
                <LiveGameCard gk={key} game={game} />
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ marginBottom: '1rem' }}>🏆 Standings</h2>
      {standings.length === 0 ? (
        <div className="info-box">
          Standings will appear after games are completed.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="standings-table">
            <thead>
              <tr>
                {['#', 'Team', 'Pool', 'GP', 'SW', 'SL', 'Pt Diff'].map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const diff = s.point_differential;
                return (
                  <tr key={s.team}>
                    <td>#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.team}</td>
                    <td>{s.pool}</td>
                    <td>{s.games_played}</td>
                    <td>{s.set_wins}</td>
                    <td>{s.set_losses}</td>
                    <td style={{
                      color: diff > 0 ? 'var(--green-leaf)' : diff < 0 ? 'var(--red-admin)' : 'inherit',
                      fontWeight: 600,
                    }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}