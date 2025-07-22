import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (socketRef.current) return;

    // --- CONEXIÓN DESACTIVADA TEMPORALMENTE ---
    // El backend tiene un problema de CORS (envía el header 'Access-Control-Allow-Origin' dos veces).
    // Para que el panel funcione con polling, se desactiva la conexión de WebSocket.
    // Para reactivar, simplemente descomenta el siguiente bloque de código.
    /*
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔥 WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      console.log('Cleaning up WebSocket connection.');
      socket.disconnect();
      socketRef.current = null;
    };
    */
  }, []);

  const on = (eventName: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(eventName, handler);
    return () => socketRef.current?.off(eventName, handler);
  };

  const emit = (eventName: string, ...args: any[]) => {
    socketRef.current?.emit(eventName, ...args);
  };

  return { isConnected, on, emit };
};
