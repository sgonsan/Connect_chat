// client/src/pages/InvitePage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function InvitePage() {
  const { code }  = useParams();
  const { token } = useAuth();
  const navigate  = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error,   setError]   = useState('');
  const [joining, setJoining] = useState(false);
  const [joined,  setJoined]  = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${code}`)
      .then(r => { if (!r.ok) throw new Error('Invite not found or expired'); return r.json(); })
      .then(setPreview)
      .catch(e => setError(e.message));
  }, [code]);

  const join = async () => {
    if (!token) { navigate(`/login?redirect=/invite/${code}`); return; }
    setJoining(true);
    const res = await fetch(`/api/invites/${code}/join`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    setJoining(false);
    if (res.status === 409) { navigate('/app'); return; }
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to join'); return; }
    setJoined(true);
    setTimeout(() => navigate('/app'), 1500);
  };

  const container = {
    minHeight: '100vh', background: 'var(--bg-900)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const card = {
    background: 'var(--bg-800)', borderRadius: 8,
    padding: 40, maxWidth: 440, width: '90vw', textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  };

  if (error) return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h2 style={{ margin: '0 0 8px' }}>Invalid Invite</h2>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/app')}>Go to App</button>
      </div>
    </div>
  );

  if (!preview) return (
    <div style={container}><div style={{ color: 'var(--text-muted)' }}>Loading…</div></div>
  );

  return (
    <div style={container}>
      <div style={card}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, margin: '0 auto 20px' }}>
          {preview.serverName[0].toUpperCase()}
        </div>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 4px', fontSize: 14 }}>
          {preview.inviterUsername} invited you to join
        </p>
        <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{preview.serverName}</h2>
        <p style={{ color: 'var(--text-muted)', margin: '0 0 32px', fontSize: 14 }}>
          {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
        </p>
        {joined ? (
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>Joined! Redirecting…</p>
        ) : (
          <button className="btn btn-primary" style={{ fontSize: 16, padding: '12px 32px' }} onClick={join} disabled={joining}>
            {joining ? 'Joining…' : 'Accept Invite'}
          </button>
        )}
      </div>
    </div>
  );
}
