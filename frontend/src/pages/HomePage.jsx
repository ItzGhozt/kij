export default function HomePage({ onNav }) {
  return (
    <div className="hero">
      <h1 className="hero-title">KIJ Volleyball Tournament</h1>
      <div style={{ marginTop: '2rem' }}>
        <div className="hero-cta-label">Ready to Play?</div>
        <button
          className="btn btn-primary"
          style={{ marginTop: '0.5rem', padding: '0.85rem 2.5rem', fontSize: '1.05rem' }}
          onClick={() => onNav('games')}
        >
          🏐 Score a Game
        </button>
      </div>
    </div>
  );
}
