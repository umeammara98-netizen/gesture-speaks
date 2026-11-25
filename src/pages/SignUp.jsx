import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const message = location.state?.message;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signup(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'The account was not created. Try again.');
    }
  };

  return (
    <div className="auth-screen">
      <Link to="/" className="back-link">Back home</Link>
      <div className="auth-card">
        <h1>Create an account</h1>
        <p className="lede">A name, an email, and a password of at least 6 characters.</p>

        {message && <p className="note" role="status" style={{ marginTop: 16 }}>{message}</p>}
        {error && <p className="note-bad" role="alert" style={{ marginTop: 16 }}>{error}</p>}

        <form className="form" onSubmit={handleSignUp}>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} type="text" className="field" autoComplete="name" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="field" autoComplete="email" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="field" autoComplete="new-password" minLength={6} required />
          </div>
          <button type="submit" className="btn">Sign up</button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
