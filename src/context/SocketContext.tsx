import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { resolveTenantSlug } from '@/utils/api';
import { useUser } from '@/hooks/useUser';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const normalizeSocketUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http/i, 'ws');
  }
  return undefined;
};

const sanitizeSocketPath = (value?: string) => {
  const normalized = value?.trim().replace(/\/+$|\s+/g, '') || '/socket.io';
  if (!normalized) return '/socket.io';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';
const socketPath = sanitizeSocketPath(import.meta.env.VITE_SOCKET_PATH || SOCKET_PATH || '/socket.io');

const resolveSocketUrl = (): string | undefined => {
  const fromEnv = normalizeSocketUrl(rawSocketUrl);
  if (fromEnv) return fromEnv;

  const fromConfig = normalizeSocketUrl(getSocketUrl());
  if (fromConfig) return fromConfig;

  if (typeof window !== 'undefined') {
    return normalizeSocketUrl(window.location.origin.replace(/^http/i, 'ws'));
  }

  return undefined;
};

const SOCKET_URL = resolveSocketUrl();

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useUser();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have a user/tenant context or if it's required globally
    // For now, we follow the pattern in useTicketUpdates
    const tenantSlug = resolveTenantSlug(user?.tenantSlug);

    // If we want to allow anonymous connection (e.g. for widget), logic might differ.
    // But this context is primarily for the Admin App (TicketPanel, etc).
    // The widget uses useChatLogic which manages its own socket.

    // We should avoid double connections if useChatLogic is also active.
    // However, SocketProvider is likely at App root.

    const token =
      safeLocalStorage.getItem('authToken') ||
      safeLocalStorage.getItem('chatAuthToken');

    const socketOptions: Partial<ManagerOptions & SocketOptions> = {
      transports: ['websocket', 'polling'], // Added polling for better compatibility
      withCredentials: true,
      path: socketPath,
    };

    if (tenantSlug) {
      socketOptions.query = {
        tenant: tenantSlug,
        tenant_slug: tenantSlug,
      };
    }

    if (token) {
      socketOptions.auth = { token };
    }

    const newSocket = io(SOCKET_URL ?? undefined, socketOptions);

    newSocket.on('connect', () => {
      console.log('Global Socket connected');
      setIsConnected(true);

      // Subscribe to ticket updates if we have a token
      if (token) {
        newSocket.emit('subscribe_ticket_updates', { token });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Global Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
        console.error('Global Socket connection error:', err);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      newSocket.close();
    };
  }, [user]); // Re-connect if user changes (e.g. login/logout or tenant switch)

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
