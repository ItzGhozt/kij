export default function NavBar({ page, admin, authenticated, onNav, onAdminToggle }) {
  const pages = [
    { key: 'home',  label: 'HOME' },
    { key: 'teams', label: 'TEAMS' },
    { key: 'games', label: 'GAMES' },
    { key: 'live',  label: 'LIVE' },
  ];

  let adminLabel = 'ADMIN';
  if (admin && authenticated) adminLabel = 'LOGOUT';
  else if (admin && !authenticated) adminLabel = 'LOGIN';

  return (
    <nav className="nav-bar">
      {pages.map((p) => (
        <button
          key={p.key}
          className={`nav-btn${page === p.key ? ' active' : ''}`}
          onClick={() => onNav(p.key)}
        >
          {p.label}
        </button>
      ))}
      <button
        className={`nav-btn${admin && authenticated ? ' admin-active' : ''}`}
        onClick={onAdminToggle}
      >
        {adminLabel}
      </button>
    </nav>
  );
}
