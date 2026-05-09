import React, { useState } from 'react';
export default function MessageInput({ onSend, channelName }) {
  const [content, setContent] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent('');
  };
  return (
    <form onSubmit={handleSubmit} className="p-4 flex gap-2">
      <input
        className="flex-1 bg-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder={`Message #${channelName}`}
        value={content}
        onChange={e => setContent(e.target.value)}
        maxLength={2000}
      />
      <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded font-semibold">Send</button>
    </form>
  );
}
