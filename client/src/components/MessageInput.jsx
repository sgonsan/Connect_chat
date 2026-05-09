// client/src/components/MessageInput.jsx
import React, { useState } from 'react';

export default function MessageInput({ onSend, channelName }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
  };

  return (
    <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-600)', borderRadius: 8 }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Message #${channelName}`}
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: 15, padding: '12px 16px',
            resize: 'none', fontFamily: 'inherit', lineHeight: 1.375,
          }}
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          style={{
            background: 'none', border: 'none', padding: '0 16px',
            cursor: value.trim() ? 'pointer' : 'default',
            color: value.trim() ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 20, transition: 'color 0.15s', flexShrink: 0,
          }}
          title="Send"
        >➤</button>
      </div>
    </div>
  );
}
