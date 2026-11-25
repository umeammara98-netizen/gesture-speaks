import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import AboutUs from './pages/AboutUs';

// ─── Protected Route: redirect to /signup if not logged in ───────────────────
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/signup" replace state={{ message: 'Sign up or sign in to open the studio.' }} />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) {
    return <Navigate to="/signup" replace state={{ message: 'Sign up or sign in to open the studio.' }} />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ─── App shell ────────────────────────────────────────────────────────────────
function AppShell() {
  const location = useLocation();
  const hideNavbar = ['/login', '/signup'].some(path => location.pathname.startsWith(path));
  const hideFooter = ['/dashboard', '/admin', '/login', '/signup'].some(path => location.pathname.startsWith(path));

  return (
    <div className="relative flex flex-col min-h-screen">
      <a className="skip" href="#main">Skip to content</a>
      {!hideNavbar && <Navbar />}
      <main id="main" className="flex-grow">
        <Routes>
          <Route path="/"          element={<Home />} />
          <Route path="/about"     element={<AboutUs />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/signup"    element={<SignUp />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          } />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}