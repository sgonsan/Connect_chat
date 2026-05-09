// client/src/components/EmojiPicker.jsx
import React from 'react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀'];

export default function EmojiPicker({ onPick, onClose }) {
  return (
    <>
      {/* Invisible overlay to catch outside clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        onClick={onClose}
      />
      <div style={{
        position: 'absolute', zIndex: 100, bottom: '100%', right: 0,
        background: 'var(--bg-600)', borderRadius: 8, padding: 6,
        display: 'flex', gap: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        marginBottom: 4,
      }}>
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); onPick(emoji); onClose(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, padding: '2px 4px', borderRadius: 4,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-500)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >{emoji}</button>
        ))}
      </div>
    </>
  );
}
