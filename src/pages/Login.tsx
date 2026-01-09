// Contenido COMPLETO y CORREGIDO para: Login.tsx

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { isPasskeySupported, loginPasskey } from "@/services/passkeys";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";

// Asegúrate de que esta interfaz refleje EXACTAMENTE lo que tu backend devuelve en /auth/login
interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    rol: string;
    tenant_slug: string;
  };
  entityToken?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useUser();
  const { currentSlug } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  // Check if this is the global login page (/login) or a tenant login page (/:slug/login)
  const isGlobalLogin = location.pathname === '/login' || location.pathname === '/login/';

  const navigateToTenantCatalog = useCallback(
    (tenantSlug?: string | null) => {
      const storedSlug = safeLocalStorage.getItem("tenantSlug");
      const fallbackSlug = tenantSlug?.toString()?.trim() || currentSlug || storedSlug || null;
      const target = buildTenantPath("/productos", fallbackSlug);
      navigate(target);
    },
    [currentSlug, navigate],
  );

  const navigateToTenantProfile = useCallback(
    (tenantSlug?: string | null) => {
      const storedSlug = safeLocalStorage.getItem("tenantSlug");
      const fallbackSlug = tenantSlug?.toString()?.trim() || currentSlug || storedSlug || null;
      const target = buildTenantPath("/perfil", fallbackSlug);
      navigate(target);
    },
    [currentSlug, navigate],
  );

  useEffect(() => {
    let mounted = true;
    isPasskeySupported()
      .then((supported) => {
        if (mounted) setIsPasskeyAvailable(supported);
      })
      .catch(() => {
        if (mounted) setIsPasskeyAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Extract tenant from the path directly, which is more reliable on login page
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const slugFromPath = (pathSegments.length > 0 && pathSegments[0] !== 'login') ? pathSegments[0] : null;

    const storedSlug = safeLocalStorage.getItem("tenantSlug");
    const effectiveSlug = slugFromPath || currentSlug || storedSlug;

    const payload: any = { email, password };
    if (effectiveSlug) {
      payload.tenant_slug = effectiveSlug;
    }

    try {
      // Always use the admin login endpoint for this component.
      const data = await apiFetch<LoginResponse>("/auth/admin/login", {
        method: "POST",
        body: payload,
      });

      safeLocalStorage.setItem("authToken", data.token);

      // The backend now reliably returns the correct tenant_slug inside the user object.
      const responseTenantSlug = data.user?.tenant_slug;

      if (responseTenantSlug) {
        safeLocalStorage.setItem("tenantSlug", responseTenantSlug);
      }

      await refreshUser(); // This will fetch user details and store them

      // After refreshUser, the user object in localStorage is updated.
      const rawUser = safeLocalStorage.getItem("user");
      const parsedUser = rawUser ? JSON.parse(rawUser) : {};

      const resolvedTenantSlug = responseTenantSlug || parsedUser.tenant_slug;

      // Redirect based on role.
      if (parsedUser.rol === "super_admin") {
        navigate("/superadmin");
      } else if (["admin", "tenant_admin", "admin_pyme", "empleado"].includes(parsedUser.rol)) {
        // For any kind of admin or employee, redirect to the global profile route.
        navigate("/perfil");
      } else {
        // Fallback for other roles, though this page is for admins.
        navigate(buildTenantPath("/", resolvedTenantSlug));
      }

    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "Credenciales inválidas o error en el servidor.");
      } else {
        setError("No se pudo conectar con el servidor.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setIsPasskeyLoading(true);
    try {
      const result = await loginPasskey();
      if (result?.token) {
        safeLocalStorage.setItem("authToken", result.token);
      }
      if (result?.entityToken) {
        safeLocalStorage.setItem("entityToken", result.entityToken);
      }
      const responseTenantSlug = (result as any)?.tenantSlug || (result as any)?.tenant_slug;
      if (responseTenantSlug) {
        safeLocalStorage.setItem("tenantSlug", responseTenantSlug);
      }
      await refreshUser();

      const rawUser = safeLocalStorage.getItem("user");
      let isAdmin = false;
      let isSuperAdmin = false;
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.rol === "super_admin" || parsed?.rol === "superadmin") {
          isSuperAdmin = true;
        }
        if (parsed?.rol === "admin" || parsed?.rol === "superadmin" || parsed?.rol === "empleado" || parsed?.rol === "super_admin") {
          isAdmin = true;
        }
      }

      if (isSuperAdmin) {
        navigate("/superadmin");
      } else if (isAdmin) {
        navigate("/perfil");
      } else {
        navigateToTenantCatalog(responseTenantSlug);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo iniciar sesión con Passkey.";
      setError(message);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // Determine the registration target path
  // If global login, force /register. If tenant login, use currentSlug.
  const registerTarget = isGlobalLogin ? '/register' : buildTenantPath("/register", currentSlug);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-base"
            disabled={isLoading || isPasskeyLoading}
          >
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
          <div className="space-y-2">
            {isPasskeyAvailable && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePasskeyLogin}
                disabled={isPasskeyLoading || isLoading}
              >
                {isPasskeyLoading ? "Verificando Passkey..." : "Entrar con Passkey"}
              </Button>
            )}
            <GoogleLoginButton className="w-full" onLoggedIn={() => navigateToTenantCatalog()} />
          </div>
        </form>
        <div className="text-center text-sm text-muted-foreground mt-4">
          ¿No tenés cuenta?{" "}
          <button onClick={() => navigate(registerTarget)} className="text-primary hover:underline">
            Registrate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
