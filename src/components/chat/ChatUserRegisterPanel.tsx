import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ClerkAuthButtons from "@/components/auth/ClerkAuthButtons";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { extractEntityToken, normalizeEntityToken, persistEntityToken } from "@/utils/entityToken";
import { resolveTenantSlug } from "@/utils/api";


interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: 'pyme' | 'municipio';
  rol?: string;
  entityToken?: string;
  entity_token?: string;
  tenantSlug?: string;
  tenant_slug?: string;
}

interface Props {
  onSuccess: (rol?: string) => void;
  onShowLogin: () => void;
  entityToken?: string;
  tenantSlug?: string | null;
  returnTo?: string | null;
}

const ChatUserRegisterPanel: React.FC<Props> = ({
  onSuccess,
  onShowLogin,
  entityToken,
  tenantSlug,
  returnTo,
}) => {
  const { refreshUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvedEntityToken, setResolvedEntityToken] = useState<string | null>(null);
  const [resolvingToken, setResolvingToken] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const effectiveTenantSlug = resolveTenantSlug(tenantSlug);

  useEffect(() => {
    nameRef.current?.focus();
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
        console.warn("[ChatUserRegisterPanel] No se pudo leer el token desde la URL", err);
      }

      setResolvingToken(true);
      try {
        const info = await apiFetch<Record<string, unknown>>("/pwa/tenant-info", {
          skipAuth: true,
          sendAnonId: true,
          isWidgetRequest: true,
          tenantSlug: effectiveTenantSlug,
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
          console.warn("[ChatUserRegisterPanel] No se pudo recuperar el token de la entidad", err);
          setResolvedEntityToken(null);
          setError("No pudimos validar la organización. Volvé a abrir el registro desde su portal e intentá nuevamente.");
        }
      } finally {
        if (active) setResolvingToken(false);
      }
    };

    captureEntityToken();

    return () => {
      active = false;
    };
  }, [effectiveTenantSlug, entityToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accepted) {
      setError("Debés aceptar los Términos y Condiciones.");
      return;
    }

    const finalEntityToken =
      normalizeEntityToken(entityToken) ||
      resolvedEntityToken ||
      normalizeEntityToken(safeLocalStorage.getItem("entityToken"));

    if (!finalEntityToken) {
      setError(
        resolvingToken
          ? "Estamos validando la organización. Esperá unos segundos e intentá nuevamente."
          : "No pudimos validar la organización para crear tu cuenta. Abrí el registro desde su portal.",
      );
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim(),
        password,
        acepto_terminos: accepted,
        empresa_token: finalEntityToken,
      };
      if (phone.trim()) payload.telefono = phone.trim();

      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;

      if (effectiveTenantSlug) {
        payload.tenant_slug = effectiveTenantSlug;
      }

      const data = await apiFetch<RegisterResponse | { token: string; user?: RegisterResponse }>("/auth/register", {
        method: "POST",
        body: payload,
        skipAuth: true,
        sendAnonId: true,
        isWidgetRequest: true,
        tenantSlug: effectiveTenantSlug,
        entityToken: finalEntityToken,
      });

      const token = (data as any)?.token;
      const userData = (data as any)?.user ?? data;
      const tenantSlug = (userData as any)?.tenantSlug || (userData as any)?.tenant_slug;

      if (!token) {
        setError("El servidor no devolvió una sesión válida. Intentá nuevamente.");
        return;
      }

      // Update the resolved token from response if available
      const confirmedEntityToken =
        (userData as any)?.entityToken || (userData as any)?.entity_token || finalEntityToken;

      safeLocalStorage.setItem("authToken", token);
      safeLocalStorage.setItem("chatAuthToken", token);
      if (tenantSlug) {
        safeLocalStorage.setItem("tenantSlug", tenantSlug);
      }
      if (confirmedEntityToken) {
        safeLocalStorage.setItem("entityToken", confirmedEntityToken);
      }

      await refreshUser();
      onSuccess((userData as any)?.rol);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "Error de registro");
      } else {
        console.error(err);
        setError("No se pudo completar el registro");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4 w-full max-w-md mx-auto animate-fade-in">
      <h2 className="text-xl font-extrabold text-center tracking-tight text-primary">
        Registrarme
      </h2>
      <form
        onSubmit={handleSubmit}
        className="space-y-3"
        autoComplete="off"
        spellCheck={false}
      >
        <Input
          ref={nameRef}
          type="text"
          placeholder="Nombre y apellido"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="name"
          required
          disabled={loading}
        />
        <Input
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
          autoComplete="new-password"
          required
          disabled={loading}
        />
        <Input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          autoComplete="tel"
          disabled={loading}
        />
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="terms"
            checked={accepted}
            onChange={() => setAccepted(!accepted)}
            required
            disabled={loading}
            className="form-checkbox h-4 w-4 text-primary bg-input border-border rounded focus:ring-primary cursor-pointer"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground">
            Acepto los{' '}
            <a href="/legal/terms" target="_blank" className="underline text-primary hover:text-primary/80">
              Términos
            </a>{' '}
            y{' '}
            <a href="/legal/privacy" target="_blank" className="underline text-primary hover:text-primary/80">
              Política de Privacidad
            </a>
            .
          </label>
        </div>
        {error && (
          <div role="alert" aria-live="assertive" className="text-destructive text-sm px-2">
            {error}
          </div>
        )}
        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? (
            <span>
              <span className="animate-spin inline-block mr-2">&#9696;</span>
              Registrando...
            </span>
          ) : (
            "Registrarme y continuar"
          )}
        </Button>
        <div className="space-y-2 pt-1">
          <ClerkAuthButtons
            mode="register"
            authIntent="tenant_portal"
            tenantSlug={effectiveTenantSlug}
            returnTo={returnTo}
            disabled={loading || !effectiveTenantSlug || !accepted}
          />
          {!effectiveTenantSlug ? (
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
              Para continuar con una red social, abrí este formulario desde el portal de la organización.
            </p>
          ) : null}
        </div>
      </form>
      <div className="text-center text-sm">
        ¿Ya tenés cuenta?{' '}
        <button onClick={onShowLogin} className="underline text-primary">
          Iniciar sesión
        </button>
      </div>
    </div>
  );
};

export default ChatUserRegisterPanel;
