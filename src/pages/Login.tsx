
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { isPasskeySupported, loginPasskey } from "@/services/passkeys";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import { enterpriseService, type DemoRubro } from "@/services/enterpriseService";
import { getRubrosHierarchy } from "@/api/rubros";
import { mapDemoOptionsFromHierarchy } from "@/utils/enterpriseExperience";
import { getDemoAccessProfiles } from "@/utils/demoAccessProfiles";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import { getFranchisePartnerConfig } from "@/utils/franchisePartnerConfig";

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
  const { timezone, locale, updateSettings } = useDateSettings();
  const { currentSlug } = useTenant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoRubro, setDemoRubro] = useState<DemoRubro | null>(null);
  const [demoOptions, setDemoOptions] = useState<Array<{ value: DemoRubro; label: string }>>([]);
  const demoAccessProfiles = getDemoAccessProfiles();
  const franchisePartner = getFranchisePartnerConfig();

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
    const loadDemoOptions = async () => {
      try {
        const hierarchy = await getRubrosHierarchy();
        if (!mounted || !Array.isArray(hierarchy)) return;
        const nextOptions = mapDemoOptionsFromHierarchy(hierarchy);
        if (nextOptions.length > 0) {
          setDemoOptions(nextOptions);
          setDemoRubro(nextOptions[0].value);
        }
      } catch (err) {
        console.warn('No se pudieron cargar rubros demo desde backend', err);
      }
    };
    loadDemoOptions();

    return () => {
      mounted = false;
    };
  }, []);

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

  const loginWithCredentials = async (nextEmail: string, nextPassword: string, tenantSlugOverride?: string) => {
    setError("");
    setIsLoading(true);

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const slugFromPath = (pathSegments.length > 0 && pathSegments[0] !== 'login') ? pathSegments[0] : null;

    const storedSlug = safeLocalStorage.getItem("tenantSlug");
    const effectiveSlug = tenantSlugOverride || slugFromPath || currentSlug || storedSlug;

    const payload: any = { email: nextEmail, password: nextPassword };
    if (effectiveSlug) {
      payload.tenant_slug = effectiveSlug;
    }

    try {
      const data = await apiFetch<LoginResponse>("/auth/admin/login", {
        method: "POST",
        body: payload,
      });

      safeLocalStorage.setItem("authToken", data.token);
      const responseTenantSlug = data.user?.tenant_slug;
      if (responseTenantSlug) {
        safeLocalStorage.setItem("tenantSlug", responseTenantSlug);
      }

      await refreshUser();
      const rawUser = safeLocalStorage.getItem("user");
      const parsedUser = rawUser ? JSON.parse(rawUser) : {};
      const resolvedTenantSlug = responseTenantSlug || parsedUser.tenant_slug;

      if (parsedUser.rol === "super_admin") {
        navigate("/superadmin");
      } else if (["admin", "tenant_admin", "admin_pyme", "empleado"].includes(parsedUser.rol)) {
        navigate("/perfil");
      } else {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(email, password);
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



  const handleDemoLogin = async () => {
    setError("");
    setIsDemoLoading(true);
    try {
      if (!demoRubro) return;
      const data = await enterpriseService.demoLogin(demoRubro);
      safeLocalStorage.setItem("authToken", data.token);
      safeLocalStorage.setItem("demoMode", String(Boolean(data.demo_mode)));
      if (data.tenant?.slug) safeLocalStorage.setItem("tenantSlug", data.tenant.slug);
      if (data.tenant?.id) safeLocalStorage.setItem("tenantId", String(data.tenant.id));
      await refreshUser();
      navigate("/analytics");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "No se pudo iniciar demo.");
      } else {
        setError("No se pudo conectar con el servidor.");
      }
    } finally {
      setIsDemoLoading(false);
    }
  };

  const registerTarget = isGlobalLogin ? '/register' : buildTenantPath("/register", currentSlug);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-2 text-center text-foreground">
          Iniciar Sesión
        </h2>
        {franchisePartner.partnerName ? (
          <p className="text-xs text-center text-muted-foreground mb-4">{franchisePartner.partnerName}</p>
        ) : null}
        <div className="mb-4">
          <Select
            value={locale}
            onValueChange={(nextLocale) => {
              const nextOption = LOCALE_OPTIONS.find((option) => option.locale === nextLocale);
              if (nextOption) updateSettings(nextOption.timezone, nextOption.locale);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Idioma / Language" />
            </SelectTrigger>
            <SelectContent>
              {LOCALE_OPTIONS.map((option) => (
                <SelectItem key={`${option.locale}-${option.timezone}`} value={option.locale}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2">Zona horaria activa: {timezone}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading || isPasskeyLoading}
            autoComplete="username"
            className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50"
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading || isPasskeyLoading}
            autoComplete="current-password"
            className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50"
          />
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
        <div className="mt-6 border-t border-border pt-4 space-y-3">
          <div className="flex gap-2">
            {demoOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={demoRubro === option.value ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDemoRubro(option.value)}
                disabled={isDemoLoading || isLoading || isPasskeyLoading}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={handleDemoLogin}
            disabled={!demoRubro || isDemoLoading || isLoading || isPasskeyLoading}
          >
            {isDemoLoading ? "Ingresando demo..." : "Probar Demo"}
          </Button>
        </div>

        {demoAccessProfiles.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">Accesos demo configurados por entorno</p>
            <div className="grid gap-2">
              {demoAccessProfiles.map((profile) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEmail(profile.email);
                    setPassword(profile.password);
                    loginWithCredentials(profile.email, profile.password, profile.tenantSlug);
                  }}
                  disabled={isLoading || isPasskeyLoading || isDemoLoading}
                >
                  {profile.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {franchisePartner.salesUrl ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full mt-4"
            onClick={() => window.open(franchisePartner.salesUrl, '_blank', 'noopener,noreferrer')}
          >
            Programa de partners
          </Button>
        ) : null}

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
