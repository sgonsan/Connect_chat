import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import MessageInput from './MessageInput';
export default function ChatArea({ channel }) {
  const { token, user } = useAuth();
  const socketRef = useSocket();
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);
  useEffect(() => {
    if (!channel) { setMessages([]); return; }
    fetch(`/api/channels/${channel.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMessages);
    const socket = socketRef?.current;
    if (!socket) return;
    socket.emit('channel:join', { channelId: channel.id });
    const onMessage = (msg) => setMessages(prev => [...prev, msg]);
    const onDeleted = ({ messageId }) => setMessages(prev => prev.filter(m => m.id !== messageId));
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);
    return () => {
      socket.emit('channel:leave', { channelId: channel.id });
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
    };
  }, [channel?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const sendMessage = (content) => { socketRef?.current?.emit('message:send', { channelId: channel.id, content }); };
  const deleteMessage = (messageId) => { socketRef?.current?.emit('message:delete', { messageId }); };
  if (!channel) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a channel to start chatting</div>;
  return (
    <div className="flex-1 flex flex-col bg-gray-700">
      <div className="p-3 border-b border-gray-600 font-semibold"># {channel.name}</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className="flex gap-2 group">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
              {(msg.user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-sm">{msg.user?.username}</span>
                <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-gray-200">{msg.content}</p>
            </div>
            {msg.user?.id === user?.id && (
              <button onClick={() => deleteMessage(msg.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-1">&#x2715;</button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageInput onSend={sendMessage} channelName={channel.name} />
    </div>
  );
}
