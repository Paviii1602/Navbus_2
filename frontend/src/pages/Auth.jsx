import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, locationGranted, showToast } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    if (!username || !password) { setError('Please fill all fields'); return; }
    setLoading(true);
    try {
      const data = await api.login(username, password);
      login({ username: data.username, role: data.role, token: data.token });
      showToast(`Welcome back, ${data.username}!`);
      if (!locationGranted) navigate('/location-permission');
      else navigate(data.role === 'driver' ? '/driver' : '/home');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob" style={{ width: 200, height: 200, top: -60, left: -60 }} />
      <div className="auth-blob" style={{ width: 150, height: 150, bottom: -40, right: -40 }} />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🚌</div>
          <h2>NavBus</h2>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>Welcome Back</h3>
          <p className="subtitle">Sign in to track your bus</p>
        </div>

        <div className="input-group">
          <label>Username</label>
          <input type="text" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</p>}
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : 'Sign In'}
        </button>
        <div className="or-divider"><span>or</span></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>New here? </span>
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Create account</Link>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, locationGranted } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError('');
    if (!username || !password) { setError('Please fill all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.register(username, password, role);
      // After registration, login to get user data
      const data = await api.login(username, password);
      login({ username: data.username, role: data.role, token: data.token });
      if (!locationGranted) navigate('/location-permission');
      else navigate(role === 'driver' ? '/driver' : '/home');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob" style={{ width: 180, height: 180, top: -50, right: -50 }} />
      <div className="auth-blob" style={{ width: 130, height: 130, bottom: -30, left: -30 }} />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🚌</div>
          <h2>NavBus</h2>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3>Create Account</h3>
          <p className="subtitle">Join NavBus to track buses in Vellore</p>
        </div>

        <div className="input-group">
          <label>Username</label>
          <input type="text" placeholder="Choose a username" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="step-label">I am a</div>
          <div className="role-toggle">
            <button className={`role-btn ${role === 'passenger' ? 'active' : ''}`} onClick={() => setRole('passenger')}>🧑 Passenger</button>
            <button className={`role-btn ${role === 'driver' ? 'active' : ''}`} onClick={() => setRole('driver')}>🚌 Driver</button>
          </div>
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</p>}
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? '...' : 'Create Account'}
        </button>
        <div className="or-divider"><span>or</span></div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Already have an account? </span>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
