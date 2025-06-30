import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/utils/api';
import { useNavigate } from 'react-router-dom';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

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
  const { refreshUser } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState('');
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<Rubro[]>('/rubros/', { skipAuth: true });
        if (Array.isArray(data)) setRubrosDisponibles(data);
      } catch (err) { setError("No se pudieron cargar los rubros."); }
    };
    fetchRubros();
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

// Importar componentes Select de shadcn/ui
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Importar Checkbox de shadcn/ui
import { Label } from "@/components/ui/label"; // Importar Label de shadcn/ui

// ... (resto de las importaciones existentes)

interface Rubro { id: number; nombre: string; } // Mantener esta interfaz localmente si solo se usa aquí
interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: 'pyme' | 'municipio';
}

const Register = () => {
  const navigate = useNavigate();
  const { refreshUser } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState(''); // El valor del Select de shadcn/ui será string
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = "Registro - Chatboc";
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<Rubro[]>('/rubros/', { skipAuth: true });
        if (Array.isArray(data)) setRubrosDisponibles(data);
      } catch (err) { setError("No se pudieron cargar los rubros."); }
    };
    fetchRubros();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) { setError("Debes aceptar los Términos y Condiciones y la Política de Privacidad."); return; }
    setIsLoading(true);
    setError('');

    const rubroMunicipio = [
      "Municipio", "Gobierno", "Concejo Deliberante",
      "Consejo Deliberante", "Intendencia", "Gobernación", "Secretaría"
    ];
    const esMunicipio = rubroMunicipio.some(
      (item) => item.toLowerCase() === rubro.trim().toLowerCase()
    );

    try {
      const payload = {
        name, email, password,
        nombre_empresa: nombreEmpresa,
        rubro,
        tipo_chat: esMunicipio ? "municipio" : "pyme",
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

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <div className="w-full max-w-lg bg-card p-6 sm:p-8 rounded-xl shadow-2xl border border-border"> {/* max-w-lg para más espacio */}
        <h2 className="text-3xl font-bold mb-8 text-center text-foreground">
          Crear Cuenta
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5"> {/* space-y-5 */}
          <Input sizeVariant="lg" type="text" placeholder="Tu nombre completo" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} autoComplete="name" />
          <Input sizeVariant="lg" type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} autoComplete="email" />
          <Input sizeVariant="lg" type="password" placeholder="Contraseña (mín. 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} autoComplete="new-password" />
          <Input sizeVariant="lg" type="text" placeholder="Nombre de tu Pyme o Municipio" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required disabled={isLoading} autoComplete="organization" />

          <Select value={rubro} onValueChange={setRubro} required disabled={isLoading}>
            <SelectTrigger className="h-12 text-base"> {/* h-12, text-base */}
              <SelectValue placeholder="Selecciona tu rubro o tipo de entidad" />
            </SelectTrigger>
            <SelectContent>
              {rubrosDisponibles.map((r) => (
                <SelectItem key={r.id} value={r.nombre} className="text-base">{r.nombre}</SelectItem> // text-base
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-start space-x-3 pt-2"> {/* items-start, space-x-3, pt-2 */}
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              required
              disabled={isLoading}
              className="mt-0.5 h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" // h-5 w-5
            />
            <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground leading-relaxed"> {/* text-sm, leading-relaxed */}
              Acepto los <Link to="/legal/terms" target="_blank" className="underline text-primary hover:text-primary/80 font-medium">Términos y Condiciones</Link> y la <Link to="/legal/privacy" target="_blank" className="underline text-primary hover:text-primary/80 font-medium">Política de Privacidad</Link>.
            </Label>
          </div>

          {error && <p className="text-destructive text-sm text-center py-1">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full text-base font-semibold"
            disabled={!accepted || isLoading}
          >
            {isLoading ? "Registrando..." : "Crear Cuenta"}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                O continuá con
              </span>
            </div>
          </div>

          <GoogleLoginButton variant="outline" className="w-full" onLoggedIn={() => navigate('/perfil')} /> {/* Corregido: варіант a variant */}

        </form>
        <div className="text-center text-base text-muted-foreground mt-6">
          ¿Ya tenés cuenta?{' '}
          <Button variant="link" size="default" onClick={() => navigate('/login')} className="text-base text-primary font-semibold">
            Iniciar sesión
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Register;
