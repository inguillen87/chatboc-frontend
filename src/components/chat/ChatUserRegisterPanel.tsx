import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { APP_TARGET } from "@/config";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";

interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: 'pyme' | 'municipio';
  rol?: string;
}

interface Props {
  onSuccess: (rol?: string) => void;
  onShowLogin: () => void;
}

const ChatUserRegisterPanel: React.FC<Props> = ({ onSuccess, onShowLogin }) => {
  const { setUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<{ id: number; nombre: string }[]>(
          "/rubros/",
          { skipAuth: true, sendEntityToken: true },
        );
        if (Array.isArray(data)) setRubrosDisponibles(data);
      } catch {
        /* ignore */
      }
    };
    fetchRubros();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accepted) {
      setError("Debés aceptar los Términos y Condiciones.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim(),
        password,
        nombre_empresa: nombreEmpresa.trim(),
        rubro: rubro.trim(),
        telefono: phone.trim(),
        acepto_terminos: accepted,
      };
      const empresaToken = safeLocalStorage.getItem("entityToken");
      payload.empresa_token = empresaToken;
      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;
      const data = await apiFetch<RegisterResponse>("/chatuserregisterpanel", {
        method: "POST",
        body: payload,
        skipAuth: true,
        sendAnonId: true,
        sendEntityToken: true,
      });
      safeLocalStorage.setItem("authToken", data.token);
      let rubro = "";
      let tipoChat = (data as any).tipo_chat as 'pyme' | 'municipio' | undefined;
      let rol = (data as any).rol as string | undefined;
      try {
        const me = await apiFetch<any>("/me");
        rubro = me?.rubro?.toLowerCase() || "";
        if (!tipoChat && me?.tipo_chat) tipoChat = me.tipo_chat;
        if (!rol && me?.rol) rol = me.rol;
      } catch {
        /* ignore */
      }
      const finalTipo = enforceTipoChatForRubro(
        (tipoChat || APP_TARGET) as 'pyme' | 'municipio',
        rubro || null,
      );
      const profile = {
        id: data.id,
        name: data.name,
        email: data.email,
        token: data.token,
        rubro,
        tipo_chat: finalTipo,
        rol,
      };
      safeLocalStorage.setItem("user", JSON.stringify(profile));
      setUser(profile);
      onSuccess(rol);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || "Error de registro");
      } else {
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
          type="text"
          placeholder="Nombre de la empresa"
          value={nombreEmpresa}
          onChange={e => setNombreEmpresa(e.target.value)}
          required
          disabled={loading}
        />
        <select
          value={rubro}
          onChange={e => setRubro(e.target.value)}
          required
          disabled={loading}
          className="w-full p-2 border rounded text-sm bg-input border-input text-foreground"
        >
          <option value="">Seleccioná tu rubro</option>
          {rubrosDisponibles.map((r) => (
            <option key={r.id} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
        </select>
        <Input
          type="tel"
          placeholder="Teléfono"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          autoComplete="tel"
          required
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
          <div className="text-destructive text-sm animate-pulse px-2">{error}</div>
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
