export default function HomePage({ onNav }) {
  return (
    <div className="hero">
      <img
        src="/logo.png"
        alt="KIJ Volleyball"
        style={{ width: 460, height: 460, objectFit: 'contain', marginBottom: '-1.5rem' }}
      />

      <button
        className="btn btn-primary"
        style={{
          padding: '0.9rem 3rem',
          fontSize: '0.95rem',
          letterSpacing: '1.5px',
          fontFamily: 'var(--font-display)',
          textTransform: 'uppercase',
          borderRadius: '4px',
        }}
        onClick={() => onNav('games')}
      >
        Score a Game
      </button>
    </div>
  );
}
