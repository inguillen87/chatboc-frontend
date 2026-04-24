import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/utils/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { isPasskeySupported, registerPasskey } from '@/services/passkeys';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';

interface Rubro { id: number; nombre: string; }
interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: 'pyme' | 'municipio';
}

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useUser();
  const { currentSlug } = useTenant();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState('');
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasskeyAvailable, setIsPasskeyAvailable] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  // Determine if we are on global /register or tenant-scoped
  const isGlobalRegister = location.pathname === '/register' || location.pathname === '/register/';
  const loginTarget = isGlobalRegister ? '/login' : buildTenantPath("/login", currentSlug);

  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<Rubro[]>('/rubros/', { skipAuth: true });
        if (Array.isArray(data)) setRubrosDisponibles(data);
      } catch (err) { setError("No se pudieron cargar los rubros."); }
    };
    fetchRubros();
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
    if (!accepted) { setError("Debés aceptar los Términos y Condiciones."); return; }
    setIsLoading(true);
    setError('');

    // --------- LOGICA NUEVA ---------
    const rubroMunicipio = [
      "Municipio",
      "Gobierno",
      "Concejo Deliberante",
      "Consejo Deliberante",
      "Intendencia",
      "Gobernación",
      "Secretaría"
    ];
    const esMunicipio = rubroMunicipio.some(
      (item) => item.toLowerCase() === rubro.trim().toLowerCase()
    );
    // --------- FIN LOGICA NUEVA ---------

    try {
      const payload = {
        name,
        email,
        password,
        nombre_empresa: nombreEmpresa,
        rubro,
        tipo_chat: esMunicipio ? "municipio" : "pyme", // NUEVO: acá se resuelve solo
        acepto_terminos: accepted,
      };

      const data = await apiFetch<RegisterResponse>("/register", {
        method: "POST",
        body: payload,
      });

      safeLocalStorage.setItem("authToken", data.token);

      await refreshUser();
      navigate('/perfil');

    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || 'Error al registrarse.');
      } else {
        setError('No se pudo completar el registro.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyRegistration = async () => {
    if (!accepted) {
      setError('Debés aceptar los Términos y Condiciones.');
      return;
    }
    setError('');
    setIsPasskeyLoading(true);
    try {
      const displayName = name || nombreEmpresa || 'Ciudadano';
      const result = await registerPasskey(displayName);
      if (result?.token) {
        safeLocalStorage.setItem('authToken', result.token);
      }
      if (result?.entityToken) {
        safeLocalStorage.setItem('entityToken', result.entityToken);
      }
      await refreshUser();
      navigate('/perfil');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo completar el registro con Passkey.';
      setError(message);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-foreground">
          Registrarse
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <Input type="text" placeholder="Nombre de la empresa" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required disabled={isLoading || isPasskeyLoading} className="bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50" />
          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            required
            disabled={isLoading || isPasskeyLoading}
            className="w-full p-2 border rounded text-sm bg-input border-input text-foreground"
          >
            <option value="">Seleccioná tu rubro</option>
            {rubrosDisponibles.map((r) => (<option key={r.id} value={r.nombre}>{r.nombre}</option>))}
          </select>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="terms" checked={accepted} onChange={() => setAccepted(!accepted)} required disabled={isLoading || isPasskeyLoading} className="form-checkbox h-4 w-4 text-primary bg-input border-border rounded focus:ring-primary cursor-pointer" />
            <label htmlFor="terms" className="text-xs text-muted-foreground">Acepto los <a href="/legal/terms" target="_blank" className="underline text-primary hover:text-primary/80">Términos</a> y <a href="/legal/privacy" target="_blank" className="underline text-primary hover:text-primary/80">Política de Privacidad</a>.</label>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 text-base"
            disabled={!accepted || isLoading || isPasskeyLoading}
          >
            {isLoading ? "Registrando..." : "Registrarse"}
          </Button>
          <div className="space-y-2">
            {isPasskeyAvailable && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePasskeyRegistration}
                disabled={isPasskeyLoading || isLoading}
              >
                {isPasskeyLoading ? 'Creando cuenta...' : 'Crear cuenta con Passkey'}
              </Button>
            )}
            <GoogleLoginButton className="w-full" onLoggedIn={() => navigate('/perfil')} />
          </div>
        </form>
        <div className="text-center text-sm mt-4 text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <button onClick={() => navigate(loginTarget)} className="text-primary hover:underline">Iniciar sesión</button>
        </div>
      </div>
    </div>
  );
};

export default Register;
