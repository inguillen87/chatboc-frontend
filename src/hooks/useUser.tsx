import React, { useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { enforceTipoChatForRubro, parseRubro } from '@/utils/tipoChat';
import { getIframeToken } from '@/utils/config';
import { getStoredEntityToken, normalizeEntityToken, persistEntityToken } from '@/utils/entityToken';

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
  entityToken?: string;
  rol?: string;
  categoria_id?: number;
  categoria_ids?: number[];
  categorias?: { id: number; nombre?: string }[];
  widget_icon_url?: string;
  widget_animation?: string;
  latitud?: number;
  longitud?: number;
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
      const hasEntity = safeLocalStorage.getItem('entityToken') || getIframeToken();
      const chatToken = safeLocalStorage.getItem('chatAuthToken');
      if (hasEntity && !chatToken) return null;
      const stored = safeLocalStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    const panelToken = safeLocalStorage.getItem('authToken');
    const chatToken = safeLocalStorage.getItem('chatAuthToken');
    const activeToken = panelToken ?? chatToken;
    const tokenKey: 'authToken' | 'chatAuthToken' | null = panelToken
      ? 'authToken'
      : chatToken
        ? 'chatAuthToken'
        : null;
    if (!activeToken) return;
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
      const normalizeCategoryIds = (value: any): number[] | undefined => {
        const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
        const normalized = values
          .map((val) => {
            const parsed = typeof val === 'number' ? val : Number(val);
            return Number.isFinite(parsed) ? Number(parsed) : null;
          })
          .filter((val): val is number => val !== null);
        return normalized.length > 0 ? normalized : undefined;
      };

      const normalizedCategories = Array.isArray(data.categorias)
        ? data.categorias
            .map((cat: any) => {
              if (!cat || typeof cat !== 'object') return null;
              const id = Number(cat.id);
              if (!Number.isFinite(id)) return null;
              return { id, nombre: cat.nombre };
            })
            .filter((cat): cat is { id: number; nombre?: string } => Boolean(cat))
        : undefined;

      const normalizedEntityToken = normalizeEntityToken(
        data.entityToken || data.entity_token || data.token_integracion,
      );
      const storedEntityToken = getStoredEntityToken();

      if (normalizedEntityToken) {
        persistEntityToken(normalizedEntityToken);
      }

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
        token: activeToken,
        entityToken: normalizedEntityToken || storedEntityToken || undefined,
        categoria_id: Number.isFinite(data.categoria_id) ? Number(data.categoria_id) : undefined,
        categoria_ids: normalizeCategoryIds(data.categoria_ids),
        categorias: normalizedCategories,
        widget_icon_url: data.widget_icon_url,
        widget_animation: data.widget_animation,
        latitud: typeof data.latitud === 'number' ? data.latitud : Number(data.latitud),
        longitud: typeof data.longitud === 'number' ? data.longitud : Number(data.longitud),
      };
      safeLocalStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (e) {
      console.error('Error fetching user profile, logging out.', e);
      // If fetching the user fails, the token is likely invalid or expired.
      // Clear the user data and token to force a re-login.
      safeLocalStorage.removeItem('user');
      if (tokenKey) {
        safeLocalStorage.removeItem(tokenKey);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token =
      safeLocalStorage.getItem('authToken') ||
      safeLocalStorage.getItem('chatAuthToken');
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
