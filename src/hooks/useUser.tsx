import React, { useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getCurrentTipoChat } from '@/utils/tipoChat';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  token?: string;
  plan?: string;
  rubro?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

interface UserContextValue {
  user: UserData | null;
  setUser: (u: UserData | null) => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const UserContext = React.createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
  loading: false,
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(() => {
    try {
      const stored = safeLocalStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    const token = safeLocalStorage.getItem('authToken');
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<any>('/me');
      const updated: UserData = {
        id: data.id,
        name: data.name,
        email: data.email,
        plan: data.plan || 'free',
        rubro: data.rubro?.toLowerCase() || '',
        tipo_chat: data.tipo_chat || getCurrentTipoChat(),
        token,
      };
      safeLocalStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (e) {
      console.error('Error fetching user profile', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem('authToken');
    if (token && (!user || !user.rubro)) {
      refreshUser();
    }
  }, [refreshUser, user]);

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  return useContext(UserContext);
}
