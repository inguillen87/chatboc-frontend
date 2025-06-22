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
}

interface Props {
  onSuccess: () => void;
}

const ChatUserRegisterPanel: React.FC<Props> = ({ onSuccess }) => {
  const { setUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        name,
        email,
        password,
      };
      if (phone) payload.telefono = phone;
      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;
      const data = await apiFetch<RegisterResponse>("/usuarios/register", {
        method: "POST",
        body: payload,
        sendAnonId: true,
        sendEntityToken: true,
      });
      safeLocalStorage.setItem("authToken", data.token);
      const profile = {
        id: data.id,
        name: data.name,
        email: data.email,
        token: data.token,
      };
      safeLocalStorage.setItem("user", JSON.stringify(profile));
      setUser(profile);
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

export default ChatUserRegisterPanel;
