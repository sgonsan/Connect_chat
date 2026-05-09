// client/src/components/ServerList.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

function ServerIcon({ server, active, onClick }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
      {active && (
        <div style={{
          position: 'absolute', left: 0, width: 4, height: 40,
          background: '#fff', borderRadius: '0 4px 4px 0',
        }} />
      )}
      <button
        title={server.name}
        onClick={onClick}
        style={{
          width: 48, height: 48,
          borderRadius: active ? 16 : '50%',
          background: active ? 'var(--accent)' : 'var(--bg-600)',
          border: 'none', cursor: 'pointer', color: 'var(--text-primary)',
          fontWeight: 700, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-radius 0.15s, background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.borderRadius = '16px'; e.currentTarget.style.background = 'var(--accent)'; } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.borderRadius = '50%'; e.currentTarget.style.background = 'var(--bg-600)'; } }}
      >
        {server.name[0].toUpperCase()}
      </button>
    </div>
  );
}

function PillButton({ title, color, icon, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 48, height: 48,
        borderRadius: hover ? 16 : '50%',
        background: hover ? color : 'var(--bg-700)',
        border: 'none', cursor: 'pointer',
        color: hover ? '#fff' : color,
        fontWeight: 700, fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'border-radius 0.15s, background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
    >{icon}</button>
  );
}

export default function ServerList({ onSelect, selectedId }) {
  const { token, user, logout } = useAuth();
  const [servers,    setServers]    = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin,   setShowJoin]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error,      setError]      = useState('');

  const fetchServers = async () => {
    const res = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setServers(await res.json());
  };

  useEffect(() => { fetchServers(); }, []);

  const createServer = async (e) => {
    e.preventDefault(); setError('');
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) { setError('Failed to create server'); return; }
    setNewName(''); setShowCreate(false); fetchServers();
  };

  const joinServer = async (e) => {
    e.preventDefault(); setError('');
    let code = inviteCode.trim();
    if (code.startsWith('http')) code = code.split('/').filter(Boolean).pop() || '';
    if (!code || !/^[a-zA-Z0-9_-]+$/.test(code)) { setError('Invalid invite code format'); return; }

    // Try new invite system first
    const inviteRes = await fetch(`/api/invites/${code}/join`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    if (inviteRes.ok) { setInviteCode(''); setShowJoin(false); fetchServers(); return; }
    if (inviteRes.status !== 404) {
      const d = await inviteRes.json(); setError(d.error || 'Invalid invite'); return;
    }

    // Fallback: legacy invite_code (UUID)
    const legacyRes = await fetch('/api/servers/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code: code }),
    });
    if (!legacyRes.ok) { const d = await legacyRes.json(); setError(d.error || 'Invalid invite'); return; }
    setInviteCode(''); setShowJoin(false); fetchServers();
  };

  return (
    <div style={{
      width: 72, minWidth: 72, background: 'var(--bg-900)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 8, overflowY: 'auto',
    }}>
      {servers.map(s => (
        <ServerIcon key={s.id} server={s} active={selectedId === s.id} onClick={() => onSelect(s)} />
      ))}

      <div style={{ width: 32, height: 2, background: 'var(--bg-600)', borderRadius: 1, margin: '4px 0' }} />

      <PillButton title="Create server" color="var(--success)" icon="+" onClick={() => { setError(''); setShowCreate(true); }} />
      <PillButton title="Join server via invite" color="var(--accent)" icon="⤵" onClick={() => { setError(''); setShowJoin(true); }} />

      <div style={{ flex: 1 }} />
      <div style={{ width: 32, height: 2, background: 'var(--bg-600)', borderRadius: 1, margin: '4px 0' }} />

      <PillButton title={`Logout (${user?.username || ''})`} color="var(--danger)" icon="⏻" onClick={logout} />

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Create a Server</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Give your server a name.</p>
            </div>
            <form onSubmit={createServer}>
              <div className="modal-body">
                <label className="field-label">Server name</label>
                <input className="field-input" placeholder="My server" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Server</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="modal-overlay" onClick={() => setShowJoin(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 20 }}>Join a Server</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Enter an invite link or code below.</p>
            </div>
            <form onSubmit={joinServer}>
              <div className="modal-body">
                <label className="field-label">Invite link or code</label>
                <input className="field-input" placeholder="https://... or abc123XYZ" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required autoFocus />
                {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Join Server</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
