import React, { createContext, useContext, useState, useCallback } from 'react';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const login = useCallback((accessToken, userData) => { setToken(accessToken); setUser(userData); }, []);
  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setToken(null); setUser(null);
  }, []);
  const refreshToken = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) { setToken(null); setUser(null); return null; }
    const { accessToken } = await res.json();
    setToken(accessToken);
    return accessToken;
  }, []);
  return <AuthContext.Provider value={{ token, user, login, logout, refreshToken }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
