
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, ApiError, NetworkError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { isPasskeySupported, loginPasskey } from "@/services/passkeys";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import { enterpriseService, extractDemoFrontendContract, isSupportedDemoFrontendContract, type DemoCatalogEntryPoint, type DemoCatalogTenant, type DemoCatalogResponse, type DemoFrontendContract, type DemoRubro } from "@/services/enterpriseService";
import { getRubrosHierarchy } from "@/api/rubros";
import { mapDemoOptionsFromHierarchy } from "@/utils/enterpriseExperience";
import { getDemoAccessProfiles } from "@/utils/demoAccessProfiles";
import { useDateSettings } from "@/hooks/useDateSettings";
import { LOCALE_OPTIONS } from "@/utils/localeOptions";
import { getFranchisePartnerConfig } from "@/utils/franchisePartnerConfig";


const isDevEnvironment = () => {
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any)?.env : undefined;
  return Boolean(metaEnv?.DEV || metaEnv?.MODE === "development");
};

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
  const [demoRubro, setDemoRubro] = useState<DemoRubro | null>('municipio');
  const [demoOptions, setDemoOptions] = useState<Array<{ value: DemoRubro; label: string }>>([
    { value: 'municipio', label: 'Municipio' },
    { value: 'pyme', label: 'PyME' },
  ]);
  const [demoEntryPoints, setDemoEntryPoints] = useState<DemoCatalogEntryPoint[]>([]);
  const [demoTenantDemos, setDemoTenantDemos] = useState<DemoCatalogTenant[]>([]);
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(true);
  const [demoLoginEndpoint, setDemoLoginEndpoint] = useState("/auth/demo");
  const [demoFrontendContract, setDemoFrontendContract] = useState<DemoFrontendContract>({});
  const [demoSector, setDemoSector] = useState<'gobierno' | 'empresas'>('gobierno');
  const demoAccessProfiles = getDemoAccessProfiles();
  const franchisePartner = getFranchisePartnerConfig();

  const isGlobalLogin = location.pathname === '/login' || location.pathname === '/login/';

  const normalizeDemoRubro = (raw: unknown): DemoRubro | null => {
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes('mun')) return 'municipio';
    if (normalized.includes('pym') || normalized.includes('emp')) return 'pyme';
    if (normalized === 'municipio' || normalized === 'pyme') return normalized;
    return null;
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const resolveSectorFromRubro = (rubro?: DemoRubro | null): 'gobierno' | 'empresas' => {
    if (rubro === 'pyme') return 'empresas';
    return 'gobierno';
  };

  const isSectorFirstMode = demoFrontendContract.demo_selector?.mode === 'sector_first';
  const needsRubroSelection = !isSectorFirstMode || demoSector === 'empresas';


  const getDemoCatalogWithRetry = useCallback(async (): Promise<DemoCatalogResponse> => {
    const retryDelaysMs = [350];
    let lastError: unknown = null;

    const shouldRetry = (error: unknown) => {
      if (error instanceof NetworkError) return true;
      if (error instanceof ApiError) {
        return error.status >= 500 || error.status === 429;
      }
      return false;
    };

    for (let attempt = 0; attempt < retryDelaysMs.length + 1; attempt += 1) {
      try {
        return await enterpriseService.getDemoCatalog();
      } catch (error) {
        lastError = error;
        if (attempt >= retryDelaysMs.length || !shouldRetry(error)) {
          break;
        }
        await wait(retryDelaysMs[attempt]);
      }
    }

    throw lastError ?? new Error('No se pudo cargar el catálogo demo.');
  }, []);

  const getEnabledTenants = (tenants: DemoCatalogTenant[] = []): DemoCatalogTenant[] => {
    return tenants.filter((tenant) => tenant?.enabled !== false);
  };

  const getDemoEntryPoints = (entryPoints: DemoCatalogEntryPoint[] = []): DemoCatalogEntryPoint[] => {
    return entryPoints.filter((entry) => {
      if (entry?.enabled === false) return false;
      const rubro = normalizeDemoRubro(entry?.rubro);
      const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
      return Boolean(rubro && label);
    });
  };

  const getDemoOptionsFromCatalog = (tenants: DemoCatalogTenant[] = []): Array<{ value: DemoRubro; label: string }> => {
    const values = new Set<DemoRubro>();
    const labelsByValue = new Map<DemoRubro, string>();

    tenants.forEach((tenant) => {
      const rawRubro = typeof tenant.rubro === 'string' && tenant.rubro.trim()
        ? tenant.rubro.trim()
        : (typeof tenant.tipo === 'string' ? tenant.tipo.trim() : '');

      const rubro = normalizeDemoRubro(rawRubro);
      if (!rubro) return;

      values.add(rubro);
      if (rawRubro && !labelsByValue.has(rubro)) {
        labelsByValue.set(rubro, rawRubro);
      }
    });

    return Array.from(values).map((value) => ({
      value,
      label: labelsByValue.get(value) || value,
    }));
  };


  const buildDemoPayload = useCallback((
    basePayload: Record<string, unknown>,
    rubro?: DemoRubro | null,
    tenantSlug?: string | null,
    sector?: 'gobierno' | 'empresas',
  ) => {
    const payload: Record<string, unknown> = { ...basePayload };
    const selector = demoFrontendContract.demo_selector;

    const resolvedSector = sector || resolveSectorFromRubro(rubro);
    if (isSectorFirstMode && payload.sector === undefined) {
      payload.sector = resolvedSector;
    }

    if (selector?.require_rubro_by_sector && resolvedSector === 'empresas' && rubro && payload.rubro === undefined) {
      payload.rubro = rubro;
    }

    if (isSectorFirstMode && resolvedSector === 'gobierno' && payload.rubro !== undefined) {
      delete payload.rubro;
    }

    const tenantSlugField = selector?.tenant_slug_field || 'tenant_slug';
    if (tenantSlug && payload[tenantSlugField] === undefined) {
      payload[tenantSlugField] = tenantSlug;
    }

    return payload;
  }, [demoFrontendContract, isSectorFirstMode]);

  const runDemoPreloadHints = useCallback(async (tenantSlugHint?: string | null) => {
    const preloadHints = new Set((demoFrontendContract.preload_before_login || []).map((item) => item.trim().toLowerCase()));
    if (preloadHints.size === 0) return;

    const tenantSlug = tenantSlugHint || currentSlug || safeLocalStorage.getItem('tenantSlug') || 'municipio';
    const jobs: Promise<unknown>[] = [];

    if (preloadHints.has('catalog')) {
      jobs.push(enterpriseService.getDemoCatalog().catch(() => undefined));
    }

    if (preloadHints.has('tenant-info') || preloadHints.has('tenant_info')) {
      jobs.push(apiFetch('/pwa/tenant-info', {
        skipAuth: true,
        tenantSlug,
        omitCredentials: true,
      }).catch(() => undefined));
    }

    if (preloadHints.has('anon-id') || preloadHints.has('anon_id')) {
      jobs.push(apiFetch('/pwa/anon-id', {
        skipAuth: true,
        tenantSlug,
        omitCredentials: true,
      }).catch(() => undefined));
    }

    await Promise.all(jobs);
  }, [currentSlug, demoFrontendContract.preload_before_login]);

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
        const catalog = await getDemoCatalogWithRetry();
        if (!mounted) return;

        const resolvedCatalog = (catalog || {}) as DemoCatalogResponse;
        const frontendContract = extractDemoFrontendContract(resolvedCatalog);
        setDemoFrontendContract(frontendContract);
        const defaultSector = frontendContract.onboarding?.default_sector || (frontendContract.demo_selector?.sector_default === 'pyme' ? 'empresas' : 'gobierno');
        setDemoSector(defaultSector);

        if (!isSupportedDemoFrontendContract(frontendContract.frontend_contract_version) && isDevEnvironment()) {
          console.warn('[Login] Unsupported demo frontend contract version', frontendContract.frontend_contract_version);
        }

        if (typeof resolvedCatalog.demo_login_enabled === "boolean") {
          setDemoLoginEnabled(resolvedCatalog.demo_login_enabled);
        }
        if (typeof resolvedCatalog.demo_login_endpoint === 'string' && resolvedCatalog.demo_login_endpoint.trim()) {
          setDemoLoginEndpoint(resolvedCatalog.demo_login_endpoint.trim());
        }

        const backendEntryPoints = getDemoEntryPoints(resolvedCatalog.entry_points);
        if (backendEntryPoints.length > 0) {
          setDemoEntryPoints(backendEntryPoints);
        }

        const tenantDemos = getEnabledTenants(resolvedCatalog.tenant_demos ?? resolvedCatalog.tenants);
        if (tenantDemos.length > 0) {
          setDemoTenantDemos(tenantDemos);
        }

        const catalogOptions = getDemoOptionsFromCatalog(tenantDemos);
        if (catalogOptions.length > 0) {
          setDemoOptions(catalogOptions);
          const defaultRubro = frontendContract.demo_selector?.sector_default;
          setDemoRubro((prev) => {
            if (prev && catalogOptions.some((option) => option.value === prev)) return prev;
            if (defaultRubro && catalogOptions.some((option) => option.value === defaultRubro)) return defaultRubro;
            return catalogOptions[0].value;
          });
          return;
        }

        const hierarchy = await getRubrosHierarchy();
        if (!mounted || !Array.isArray(hierarchy)) return;
        const nextOptions = mapDemoOptionsFromHierarchy(hierarchy);
        if (nextOptions.length > 0) {
          setDemoOptions(nextOptions);
          const defaultRubro = frontendContract.demo_selector?.sector_default;
          setDemoRubro((prev) => {
            if (prev && nextOptions.some((option) => option.value === prev)) return prev;
            if (defaultRubro && nextOptions.some((option) => option.value === defaultRubro)) return defaultRubro;
            return nextOptions[0].value;
          });
        }
      } catch (err) {
        if (isDevEnvironment()) {
          console.warn('No se pudieron cargar rubros demo desde backend', err);
        }
        setDemoOptions((prev) => (prev.length ? prev : [
          { value: 'municipio', label: 'Municipio' },
          { value: 'pyme', label: 'PyME' },
        ]));
        setDemoRubro((prev) => prev || 'municipio');
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

      const responseRole = data.user?.rol;
      const resolvedTenantSlug = responseTenantSlug || currentSlug || safeLocalStorage.getItem("tenantSlug") || undefined;
      const storedUserRaw = safeLocalStorage.getItem("user");
      if (storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          safeLocalStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              rol: responseRole || storedUser?.rol,
              tenant_slug: resolvedTenantSlug || storedUser?.tenant_slug,
              tenantSlug: resolvedTenantSlug || storedUser?.tenantSlug,
            }),
          );
        } catch {
          safeLocalStorage.removeItem("user");
        }
      }

      if (responseRole === "super_admin") {
        navigate("/superadmin");
      } else if (["admin", "tenant_admin", "admin_pyme", "empleado"].includes(responseRole)) {
        navigate("/perfil");
      } else {
        navigate(buildTenantPath("/", resolvedTenantSlug));
      }

      refreshUser().catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status >= 500
          ? "Servicio temporalmente no disponible. Intentá nuevamente en unos minutos."
          : (err.body?.error || "Credenciales inválidas o error en el servidor."));
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



  const handleDemoLogin = async (rubroOverride?: DemoRubro, payloadOverride?: Record<string, unknown>, endpointOverride?: string) => {
    setError("");
    setIsDemoLoading(true);
    try {
      const resolvedRubro = rubroOverride || demoRubro;
      const resolvedSector = isSectorFirstMode ? demoSector : resolveSectorFromRubro(resolvedRubro);
      const resolvedPayload = payloadOverride || (needsRubroSelection
        ? (resolvedRubro ? { rubro: resolvedRubro } : null)
        : { sector: resolvedSector });
      if (!resolvedPayload) return;

      const tenantSlugHint =
        (typeof resolvedPayload.tenant_slug === 'string' && resolvedPayload.tenant_slug) ||
        (typeof resolvedPayload.tenantSlug === 'string' && resolvedPayload.tenantSlug) ||
        currentSlug ||
        safeLocalStorage.getItem('tenantSlug') ||
        null;

      await runDemoPreloadHints(tenantSlugHint);
      const requestPayload = buildDemoPayload(resolvedPayload, resolvedRubro, tenantSlugHint, resolvedSector);
      const data = await enterpriseService.demoLoginWithPayload(requestPayload, endpointOverride || demoLoginEndpoint);
      safeLocalStorage.setItem("authToken", data.token);
      safeLocalStorage.setItem("demoMode", String(Boolean(data.demo_mode)));
      if (data.tenant?.slug) safeLocalStorage.setItem("tenantSlug", data.tenant.slug);
      if (data.tenant?.id) safeLocalStorage.setItem("tenantId", String(data.tenant.id));
      const storedUserRaw = safeLocalStorage.getItem("user");
      if (storedUserRaw) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          safeLocalStorage.setItem(
            "user",
            JSON.stringify({
              ...storedUser,
              rol: data.user?.rol || storedUser?.rol,
              tenant_slug: data.tenant?.slug || storedUser?.tenant_slug,
              tenantSlug: data.tenant?.slug || storedUser?.tenantSlug,
            }),
          );
        } catch {
          safeLocalStorage.removeItem("user");
        }
      }
      navigate("/analytics");
      refreshUser().catch(() => undefined);
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
          {!demoLoginEnabled ? (
            <p className="text-xs text-muted-foreground">Demo no disponible actualmente.</p>
          ) : null}
          {isSectorFirstMode ? (
            <div className="flex gap-2">
              {(demoFrontendContract.onboarding?.sector_options?.length
                ? demoFrontendContract.onboarding.sector_options
                : [
                    { value: 'gobierno', label: 'Gobierno' },
                    { value: 'empresas', label: 'Empresas' },
                  ]).map((sectorOption) => (
                <Button
                  key={sectorOption.value}
                  type="button"
                  variant={demoSector === sectorOption.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => {
                    setDemoSector(sectorOption.value);
                    if (sectorOption.value === 'gobierno') {
                      setDemoRubro('municipio');
                    }
                  }}
                  disabled={!demoLoginEnabled || isDemoLoading || isLoading || isPasskeyLoading}
                >
                  {sectorOption.label || (sectorOption.value === 'gobierno' ? 'Gobierno' : 'Empresas')}
                </Button>
              ))}
            </div>
          ) : null}
          {needsRubroSelection ? (
            <div className="flex gap-2">
              {demoOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={demoRubro === option.value ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setDemoRubro(option.value); setDemoSector(resolveSectorFromRubro(option.value)); }}
                  disabled={!demoLoginEnabled || isDemoLoading || isLoading || isPasskeyLoading}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            className="w-full"
            onClick={() => { void handleDemoLogin(); }}
            disabled={!demoLoginEnabled || (needsRubroSelection && !demoRubro) || isDemoLoading || isLoading || isPasskeyLoading}
          >
            {isDemoLoading ? "Ingresando demo..." : "Probar Demo"}
          </Button>
          {demoEntryPoints.length > 0 ? (
            <div className="grid gap-2">
              {demoEntryPoints.map((entry) => {
                const rubro = normalizeDemoRubro(entry.rubro);
                if (!rubro) return null;
                return (
                  <Button
                    key={entry.id || `${rubro}-${entry.label}`}
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDemoRubro(rubro);
                      const payload = entry.login_payload && Object.keys(entry.login_payload).length > 0
                        ? entry.login_payload
                        : { rubro };
                      void handleDemoLogin(rubro, payload, entry.login_endpoint || demoLoginEndpoint);
                    }}
                    disabled={!demoLoginEnabled || entry.enabled === false || isDemoLoading || isLoading || isPasskeyLoading}
                  >
                    {entry.label}
                  </Button>
                );
              })}
            </div>
          ) : null}
          {demoTenantDemos.length > 0 ? (
            <div className="grid gap-2">
              {demoTenantDemos.map((tenantDemo, index) => {
                const rubro = normalizeDemoRubro(tenantDemo.rubro || tenantDemo.tipo);
                const payload = tenantDemo.login_payload && Object.keys(tenantDemo.login_payload).length > 0
                  ? tenantDemo.login_payload
                  : (rubro ? { rubro } : null);
                return (
                  <Button
                    key={tenantDemo.id || tenantDemo.slug || `${tenantDemo.nombre || 'demo'}-${index}`}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (rubro) setDemoRubro(rubro);
                      if (!payload) return;
                      void handleDemoLogin(rubro || undefined, payload, tenantDemo.login_endpoint || demoLoginEndpoint);
                    }}
                    disabled={!demoLoginEnabled || tenantDemo.enabled === false || !payload || isDemoLoading || isLoading || isPasskeyLoading}
                  >
                    {tenantDemo.nombre || tenantDemo.slug || 'Demo'}
                  </Button>
                );
              })}
            </div>
          ) : null}
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
