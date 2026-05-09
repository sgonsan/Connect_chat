// client/src/components/InviteModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function InviteModal({ server, onClose }) {
  const { token } = useAuth();
  const [expiresIn, setExpiresIn] = useState('24');
  const [maxUses,   setMaxUses]   = useState('');
  const [invite,    setInvite]    = useState(null);
  const [copied,    setCopied]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setCopied(false);
    const body = {};
    if (expiresIn !== 'never') body.expiresIn = Number(expiresIn);
    if (maxUses)               body.maxUses   = Number(maxUses);

    const res = await fetch(`/api/servers/${server.id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) { setError('Failed to generate invite'); return; }
    setInvite(await res.json());
  };

  const copy = () => {
    navigator.clipboard.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 20 }}>Invite people to {server.name}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Share this link with others to grant access.
          </p>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Expiry</label>
              <select value={expiresIn} onChange={e => setExpiresIn(e.target.value)}
                className="field-input" style={{ cursor: 'pointer' }}>
                <option value="1">1 hour</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
                <option value="never">Never</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Max uses</label>
              <input className="field-input" type="number" min="1" placeholder="Unlimited"
                value={maxUses} onChange={e => setMaxUses(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={generate} disabled={loading}
            style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Generating…' : 'Generate invite link'}
          </button>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{error}</p>}

          {invite && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="field-input" readOnly value={invite.url}
                style={{ flex: 1, fontSize: 13 }} onFocus={e => e.target.select()} />
              <button className="btn btn-primary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {invite?.expiresAt && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
              Expires {new Date(invite.expiresAt).toLocaleString()}
              {invite.maxUses ? ` · Max ${invite.maxUses} uses` : ' · Unlimited uses'}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
