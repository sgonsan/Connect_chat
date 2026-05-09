import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
export default function ChannelList({ server, onSelect, onSelectVoiceChannel, selectedId }) {
  const { token } = useAuth();
  const [channels, setChannels] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('text');
  const [inviteVisible, setInviteVisible] = useState(false);
  const fetchChannels = () => {
    if (!server) { setChannels([]); return; }
    fetch(`/api/servers/${server.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(data => setChannels(data.channels || []));
  };
  useEffect(() => { fetchChannels(); }, [server]);
  const createChannel = async (e) => {
    e.preventDefault();
    await fetch(`/api/servers/${server.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.toLowerCase().replace(/\s+/g, '-'), type: newType }),
    });
    setNewName(''); setNewType('text'); setShowCreate(false); fetchChannels();
  };
  const textChannels = channels.filter(c => !c.type || c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');
  if (!server) return <div className="w-48 bg-gray-800 flex items-center justify-center text-gray-500 text-sm">Select a server</div>;
  return (
    <div className="w-48 bg-gray-800 flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h2 className="font-bold truncate">{server.name}</h2>
        <button onClick={() => setInviteVisible(v => !v)} className="text-xs text-gray-400 hover:text-white mt-1">
          {inviteVisible ? 'Hide invite' : 'Show invite'}
        </button>
        {inviteVisible && <p className="text-xs text-gray-300 break-all mt-1">{server.invite_code}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center justify-between px-1 text-xs text-gray-400 uppercase mb-1">
          <span>Text Channels</span>
          <button onClick={() => setShowCreate(true)} className="hover:text-white">+</button>
        </div>
        {textChannels.map(c => (
          <button key={c.id} onClick={() => onSelect(c)}
            className={`w-full text-left px-2 py-1 rounded text-sm
              ${selectedId === c.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
            # {c.name}
          </button>
        ))}
        {voiceChannels.length > 0 && (
          <>
            <div className="flex items-center justify-between px-1 text-xs text-gray-400 uppercase mt-3 mb-1">
              <span>Voice Channels</span>
            </div>
            {voiceChannels.map(c => (
              <button key={c.id} onClick={() => onSelectVoiceChannel && onSelectVoiceChannel(c)}
                className={`w-full text-left px-2 py-1 rounded text-sm
                  ${selectedId === c.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                🔊 {c.name}
              </button>
            ))}
          </>
        )}
      </div>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <form onSubmit={createChannel} className="bg-gray-700 p-6 rounded-lg w-72 space-y-3">
            <h2 className="font-bold">Create Channel</h2>
            <input className="w-full p-2 rounded bg-gray-600" placeholder="channel-name"
              value={newName} onChange={e => setNewName(e.target.value)} required />
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-sm text-gray-300">
                <input type="radio" name="channelType" value="text" checked={newType === 'text'}
                  onChange={() => setNewType('text')} />
                Text
              </label>
              <label className="flex items-center gap-1 text-sm text-gray-300">
                <input type="radio" name="channelType" value="voice" checked={newType === 'voice'}
                  onChange={() => setNewType('voice')} />
                Voice
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-indigo-600 p-2 rounded">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-600 p-2 rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
