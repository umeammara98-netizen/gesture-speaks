import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const TOKEN_KEY = 'gs_token';
const AuthContext = createContext(null);

async function request(path, { token, body, method } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('The account server is not running.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : 'Request failed.';
    throw new Error(detail);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((token, nextUser) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    setUser(nextUser);
  }, []);

  const refreshClaims = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return false;
    }
    try {
      const data = await request('/api/auth/me', { token });
      setUser(data.user);
      return Boolean(data.user?.admin);
    } catch {
      applySession(null, null);
      return false;
    }
  }, [applySession]);

  useEffect(() => {
    refreshClaims().finally(() => setLoading(false));
  }, [refreshClaims]);

  const getIdToken = () => localStorage.getItem(TOKEN_KEY);

  const signup = async (email, password, name) => {
    const data = await request('/api/auth/signup', { body: { email, password, name } });
    applySession(data.token, data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const data = await request('/api/auth/login', { body: { email, password } });
    applySession(data.token, data.user);
    return data.user;
  };

  const logout = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    applySession(null, null);
    if (token) {
      try {
        await request('/api/auth/logout', { token, method: 'POST' });
      } catch {
        // The local session is already cleared.
      }
    }
  };

  if (loading) return <div className="boot">Loading.</div>;

  return (
    <AuthContext.Provider value={{ user, isAdmin: Boolean(user?.admin), refreshClaims, getIdToken, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
