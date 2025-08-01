import React, { useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { enforceTipoChatForRubro, parseRubro } from '@/utils/tipoChat';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  token?: string;
  plan?: string;
  rubro?: string;
  nombre_empresa?: string;
  logo_url?: string;
  picture?: string;
  tipo_chat?: 'pyme' | 'municipio';
  rol?: string;
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
    const rubroNorm = parseRubro(data.rubro) || '';
    if (!data.tipo_chat) {
      console.warn('tipo_chat faltante en respuesta de /me');
    }
    if (!data.rol) {
      console.warn('rol faltante en respuesta de /me');
    }
    const finalTipo = data.tipo_chat
      ? enforceTipoChatForRubro(data.tipo_chat as 'pyme' | 'municipio', rubroNorm)
      : undefined;
    const updated: UserData = {
      id: data.id,
      name: data.name,
      email: data.email,
      plan: data.plan || 'free',
      rubro: rubroNorm,
      nombre_empresa: data.nombre_empresa,
      logo_url: data.logo_url,
      picture: data.picture,
      tipo_chat: finalTipo,
      rol: data.rol,
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
