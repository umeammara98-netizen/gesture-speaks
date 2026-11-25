import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <span>© {new Date().getFullYear()} Gesture Speaks</span>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/#directions">Directions</Link>
          <Link to="/about">About</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
