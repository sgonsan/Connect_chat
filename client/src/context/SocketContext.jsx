import React, { createContext, useContext, useEffect, useRef } from 'react';
import { getSocket, disconnectSocket } from '../socket';
import { useAuth } from './AuthContext';
const SocketContext = createContext(null);
export function SocketProvider({ children }) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    s.connect();
    socketRef.current = s;
    return () => { disconnectSocket(); socketRef.current = null; };
  }, [token]);
  return <SocketContext.Provider value={socketRef}>{children}</SocketContext.Provider>;
}
export const useSocket = () => useContext(SocketContext);
