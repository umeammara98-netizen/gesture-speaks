import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function errorText(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  return fallback;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function Admin() {
  const { user, getIdToken, refreshClaims } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState('');

  const loadUsers = useCallback(async () => {
    setError('');
    const token = await getIdToken();
    const response = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(errorText(data, 'Could not load users.'));
    }
    setUsers(data.users || []);
  }, [getIdToken]);

  useEffect(() => {
    let active = true;
    loadUsers()
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadUsers]);

  const updateUser = async (uid, body) => {
    setPendingId(uid);
    setError('');
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorText(data, 'Update failed.'));
      }
      if (uid === user?.uid && body.admin === false) {
        const stillAdmin = await refreshClaims();
        if (!stillAdmin) {
          navigate('/dashboard', { replace: true });
          return;
        }
      }
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId('');
    }
  };

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Accounts</h1>
            <p>People who have signed up.</p>
          </div>
        </div>

        {error && (
          <p className="note-bad" style={{ marginBottom: 16 }}>{error}</p>
        )}

        <div className="table-wrap">
          {loading ? (
            <p className="hint" style={{ padding: 24 }}>Loading the list.</p>
          ) : (
            <div>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => {
                    const mine = row.uid === user?.uid;
                    const locked = pendingId === row.uid;
                    return (
                      <tr key={row.uid}>
                        <td>{row.name || '—'}</td>
                        <td>{row.email || '—'}</td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>{row.admin ? 'Admin' : 'User'}</td>
                        <td>{row.disabled ? 'Disabled' : 'Active'}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              disabled={locked}
                              onClick={() => updateUser(row.uid, { admin: !row.admin })}
                              className="btn"
                              type="button"
                            >
                              {row.admin ? 'Remove admin' : 'Make admin'}
                            </button>
                            <button
                              disabled={locked || mine}
                              onClick={() => updateUser(row.uid, { disabled: !row.disabled })}
                              title={mine ? 'You cannot disable your own account' : ''}
                              className="btn btn-quiet"
                              type="button"
                            >
                              {row.disabled ? 'Enable' : 'Disable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6}>No accounts yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
