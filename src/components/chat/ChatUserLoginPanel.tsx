import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { apiFetch, ApiError, resolveTenantSlug } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { broadcastAuthTokenToHost } from "@/utils/postMessage";
import { extractEntityToken, normalizeEntityToken, persistEntityToken } from "@/utils/entityToken";

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan?: string;
  tipo_chat?: 'pyme' | 'municipio';
  rol?: string;
  widget_icon_url?: string;
  widget_animation?: string;
  entityToken?: string;
  entity_token?: string;
  tenantSlug?: string;
  tenant_slug?: string;
  public_cart_url?: string;
  publicCartUrl?: string;
}

interface Props {
  onSuccess: (rol?: string) => void;
  onShowRegister: () => void;
  entityToken?: string;
}

const ChatUserLoginPanel: React.FC<Props> = ({ onSuccess, onShowRegister, entityToken }) => {
  const { refreshUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedEntityToken, setResolvedEntityToken] = useState<string | null>(null);
  const [resolvingToken, setResolvingToken] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      if (tokenFromUrl) {
        safeLocalStorage.setItem('entityToken', tokenFromUrl);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const captureEntityToken = async () => {
      const fromProp = normalizeEntityToken(entityToken);
      if (fromProp) {
        setResolvedEntityToken(fromProp);
        persistEntityToken(fromProp);
        return;
      }

      const fromStorage = normalizeEntityToken(safeLocalStorage.getItem("entityToken"));
      if (fromStorage) {
        setResolvedEntityToken(fromStorage);
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = normalizeEntityToken(params.get("token"));
        if (tokenFromUrl) {
          persistEntityToken(tokenFromUrl);
          setResolvedEntityToken(tokenFromUrl);
          return;
        }
      } catch (err) {
        console.warn("[ChatUserLoginPanel] No se pudo leer el token desde la URL", err);
      }

      setResolvingToken(true);
      try {
        const tenantSlug = resolveTenantSlug();
        const info = await apiFetch<Record<string, unknown>>("/pwa/tenant-info", {
          skipAuth: true,
          sendAnonId: true,
          isWidgetRequest: true,
          tenantSlug,
          omitCredentials: true,
        });
        if (!active) return;
        const tokenFromApi = extractEntityToken(info);
        if (tokenFromApi) {
          setResolvedEntityToken(tokenFromApi);
          persistEntityToken(tokenFromApi);
        }
      } catch (err) {
        if (active) {
          console.warn("[ChatUserLoginPanel] No se pudo recuperar el token de la entidad", err);
        }
      } finally {
        if (active) setResolvingToken(false);
      }
    };

    captureEntityToken();

    return () => {
      active = false;
    };
  }, [entityToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, any> = { email, password };
      const currentEntityToken =
        resolvedEntityToken ||
        normalizeEntityToken(entityToken) ||
        normalizeEntityToken(safeLocalStorage.getItem("entityToken"));

      if (!currentEntityToken) {
        if (resolvingToken) {
          setError("Buscando los datos de la entidad. Por favor intentá nuevamente en unos segundos.");
        } else {
          setError("No se pudo obtener el token de la entidad para iniciar sesión.");
        }
        setLoading(false);
        return;
      }

      payload.empresa_token = currentEntityToken;
      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;

      const currentTenantSlug = resolveTenantSlug();

      if (currentTenantSlug) {
        payload.tenant_slug = currentTenantSlug;
      }

      // Explicitly send X-Tenant header for login to ensure correct context binding if applicable
      const headers: Record<string, string> = {};
      if (currentTenantSlug) {
        headers['X-Tenant'] = currentTenantSlug;
      }

      const data = await apiFetch<LoginResponse | { token: string; user?: LoginResponse }>("/auth/login", {
        method: "POST",
        body: payload,
        sendAnonId: true,
        isWidgetRequest: true,
        tenantSlug: currentTenantSlug,
        entityToken: currentEntityToken,
      });

      const token = (data as any)?.token;
      const userData = (data as any)?.user ?? data;
      const entityToken =
        (userData as any)?.entityToken || (userData as any)?.entity_token || safeLocalStorage.getItem("entityToken");
      const tenantSlug = (userData as any)?.tenantSlug || (userData as any)?.tenant_slug;

      if (token) {
        safeLocalStorage.setItem("authToken", token);
        safeLocalStorage.setItem("chatAuthToken", token);
        broadcastAuthTokenToHost(token, tenantSlug ?? resolveTenantSlug(), "login-panel");
      }
      if (tenantSlug) {
        safeLocalStorage.setItem("tenantSlug", tenantSlug);
      }
      if (entityToken) {
        safeLocalStorage.setItem("entityToken", entityToken);
      }

      await refreshUser();
      onSuccess((userData as any)?.rol);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "Credenciales inválidas");
      } else {
        setError("No se pudo iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in">
      <h2 className="text-xl font-extrabold text-center tracking-tight text-primary">Iniciar sesión</h2>
      <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off" spellCheck={false}>
        <Input
          ref={emailRef}
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={loading}
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={loading}
        />
        {error && <div className="text-destructive text-sm px-2">{error}</div>}
        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
        <GoogleLoginButton className="mt-2" onLoggedIn={onSuccess} />
      </form>
      <div className="text-center text-sm">
        ¿No tenés cuenta?{' '}
        <button onClick={onShowRegister} className="underline text-primary">
          Registrate
        </button>
      </div>
    </div>
  );
};

export default ChatUserLoginPanel;
