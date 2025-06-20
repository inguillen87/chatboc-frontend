import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";

interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: "pyme" | "municipio";
}

interface Props {
  onSuccess: () => void;
}

const ChatRegisterPanel: React.FC<Props> = ({ onSuccess }) => {
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

  // UX: Autofocus al primer input
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Traemos los rubros al inicio
  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<{ id: number; nombre: string }[]>("/rubros/", {
          skipAuth: true,
          sendEntityToken: true,
        });
        if (Array.isArray(data)) setRubrosDisponibles(data);
      } catch {/* ignore */}
    };
    fetchRubros();
  }, []);

  // Manejamos el envío del form
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
        name,
        email,
        password,
        nombre_empresa: nombreEmpresa,
        rubro,
        acepto_terminos: accepted,
      };
      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;
      if (phone) payload.telefono = phone;
      const data = await apiFetch<RegisterResponse>("/register", {
        method: "POST",
        body: payload,
        sendAnonId: true,
        sendEntityToken: true,
      });
      safeLocalStorage.setItem("authToken", data.token);
      let finalTipo = data.tipo_chat;
      try {
        const me = await apiFetch<any>("/me");
        finalTipo = me?.tipo_chat || finalTipo;
        const profile = {
          id: data.id,
          name: data.name,
          email: data.email,
          token: data.token,
          rubro: me?.rubro?.toLowerCase() || "",
          tipo_chat: finalTipo || "pyme",
        };
        safeLocalStorage.setItem("user", JSON.stringify(profile));
        setUser(profile);
      } catch {/* ignore */}
      // UX: feedback de éxito (opcional: reemplazá por tu toast/snackbar preferido)
      // alert('Registro exitoso');
      onSuccess();
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
      <h2 className="text-xl font-extrabold text-center tracking-tight text-primary">Crear cuenta</h2>
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
        <Input
          type="text"
          placeholder="Nombre de la empresa"
          value={nombreEmpresa}
          onChange={e => setNombreEmpresa(e.target.value)}
          autoComplete="organization"
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
          {rubrosDisponibles.map(r => (
            <option key={r.id} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
        </select>
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
            Acepto los{" "}
            <a
              href="/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary hover:text-primary/80"
            >
              Términos
            </a>{" "}
            y{" "}
            <a
              href="/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary hover:text-primary/80"
            >
              Política de Privacidad
            </a>
            .
          </label>
        </div>
        {/* Error animado */}
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
    </div>
  );
};

export default ChatRegisterPanel;
