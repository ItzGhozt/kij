import { useState } from 'react';
import { Api } from '../api/http';

export default function AdminLoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    Api.login(username, password)
      .then(() => onLogin())
      .catch((err) => setError(err.message || 'Invalid credentials'));
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto' }}>
      <div className="card">
        <h2 className="text-center">🔑 Admin Login</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username</label>
            <input
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          {error && (
            <div style={{ color: 'var(--red-admin)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
              ❌ {error}
            </div>
          )}
          <button className="btn btn-secondary btn-block" type="submit">
            🚀 Login
          </button>
        </form>
      </div>
    </div>
  );
}
