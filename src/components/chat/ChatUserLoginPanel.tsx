import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";
import { APP_TARGET } from "@/config";
import { enforceTipoChatForRubro } from "@/utils/tipoChat";

interface LoginResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  plan?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

interface Props {
  onSuccess: () => void;
  onShowRegister: () => void;
}

const ChatUserLoginPanel: React.FC<Props> = ({ onSuccess, onShowRegister }) => {
  const { setUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, any> = { email, password };
      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;
      const data = await apiFetch<LoginResponse>("/login", {
        method: "POST",
        body: payload,
        sendAnonId: true,
        sendEntityToken: true,
      });
      safeLocalStorage.setItem("authToken", data.token);
      let rubro = "";
      let tipoChat = (data as any).tipo_chat as 'pyme' | 'municipio' | undefined;
      try {
        const me = await apiFetch<any>("/me");
        rubro = me?.rubro?.toLowerCase() || "";
        if (!tipoChat && me?.tipo_chat) tipoChat = me.tipo_chat;
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
      };
      safeLocalStorage.setItem("user", JSON.stringify(profile));
      setUser(profile);
      onSuccess();
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
