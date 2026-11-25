import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const account = await login(email, password);
      navigate(account.admin ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'That email and password did not match. Try again.');
    }
  };

  return (
    <div className="auth-screen">
      <Link to="/" className="back-link">Back home</Link>
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="lede">Same email you used to sign up.</p>

        {message && <p className="note" role="status" style={{ marginTop: 16 }}>{message}</p>}
        {error && <p className="note-bad" role="alert" style={{ marginTop: 16 }}>{error}</p>}

        <form className="form" onSubmit={handleLogin}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="field" autoComplete="email" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="field" autoComplete="current-password" required />
          </div>
          <button type="submit" className="btn">Sign in</button>
        </form>

        <p className="auth-switch">Need an account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
