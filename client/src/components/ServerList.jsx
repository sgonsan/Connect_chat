import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
export default function ServerList({ onSelect, selectedId }) {
  const { token, logout } = useAuth();
  const [servers, setServers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const fetchServers = async () => {
    const res = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setServers(await res.json());
  };
  useEffect(() => { fetchServers(); }, []);
  const createServer = async (e) => {
    e.preventDefault();
    await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName }),
    });
    setNewName(''); setShowCreate(false); fetchServers();
  };
  const joinServer = async (e) => {
    e.preventDefault();
    await fetch('/api/servers/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code: inviteCode }),
    });
    setInviteCode(''); setShowJoin(false); fetchServers();
  };
  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 gap-2">
      {servers.map(s => (
        <button key={s.id} title={s.name} onClick={() => onSelect(s)}
          className={`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center
            ${selectedId === s.id ? 'bg-indigo-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {s.name[0].toUpperCase()}
        </button>
      ))}
      <button onClick={() => setShowCreate(true)} title="Create server"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-green-600 font-bold text-xl">+</button>
      <button onClick={() => setShowJoin(true)} title="Join server"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-blue-600 font-bold text-xs">&#x21AA;</button>
      <div className="flex-1" />
      <button onClick={logout} title="Log out"
        className="w-10 h-10 rounded-full bg-gray-700 hover:bg-red-600 text-xs">&#x2715;</button>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createServer} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Create Server</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="Server name"
              value={newName} onChange={e => setNewName(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {showJoin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={joinServer} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Join Server</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="Invite code (UUID)"
              value={inviteCode} onChange={e => setInviteCode(e.target.value)} required />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Join</button>
              <button type="button" onClick={() => setShowJoin(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
