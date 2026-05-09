import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      login(data.accessToken, data.user);
      navigate('/app');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="flex items-center justify-center h-screen">
      <form onSubmit={handleSubmit} className="bg-gray-700 p-8 rounded-lg w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center">Connect Chat</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input className="w-full p-2 rounded bg-gray-600 text-white" type="email" placeholder="Email"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        <input className="w-full p-2 rounded bg-gray-600 text-white" type="password" placeholder="Password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
        <button type="submit" disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 p-2 rounded font-semibold">
          {loading ? 'Loading...' : 'Log In'}
        </button>
        <p className="text-sm text-center text-gray-400">No account? <Link to="/register" className="text-indigo-400 hover:underline">Register</Link></p>
      </form>
    </div>
  );
}
