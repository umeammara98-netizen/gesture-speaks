import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isApp = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');
  const displayName = user?.name || user?.email || '';
  const close = () => setOpen(false);

  const links = [
    { label: 'Directions', to: '/#directions' },
    { label: 'About', to: '/about' },
  ];

  return (
    <header className="nav">
      <div className="wrap nav-row">
        <Link to="/" className="wordmark">Gesture Speaks</Link>

        {!isApp && (
          <nav className="nav-links" aria-label="Pages">
            {links.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                aria-current={location.pathname === link.to ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="nav-actions">
          {user ? (
            <>
              <span className="who">{displayName}</span>
              {!isApp && <Link className="btn" to="/dashboard">Start the studio</Link>}
              {isAdmin && <Link className="btn btn-quiet" to="/admin">Accounts</Link>}
              <button className="btn btn-quiet" type="button" onClick={logout}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-quiet" to="/login">Sign in</Link>
              <Link className="btn" to="/signup">Start the studio</Link>
            </>
          )}
        </div>

        <button
          className="menu-btn"
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="wrap mobile-menu">
          {!isApp && links.map((link) => (
            <Link key={link.label} to={link.to} onClick={close}>{link.label}</Link>
          ))}
          {user ? (
            <>
              <span className="who">{displayName}</span>
              {!isApp && <Link className="btn" to="/dashboard" onClick={close}>Start the studio</Link>}
              {isAdmin && <Link className="btn btn-quiet" to="/admin" onClick={close}>Accounts</Link>}
              <button className="btn btn-quiet" type="button" onClick={() => { logout(); close(); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-quiet" to="/login" onClick={close}>Sign in</Link>
              <Link className="btn" to="/signup" onClick={close}>Start the studio</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
