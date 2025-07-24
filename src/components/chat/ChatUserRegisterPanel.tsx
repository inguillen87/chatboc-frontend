import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Upload } from "lucide-react";
import { apiFetch, ApiError } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { useUser } from "@/hooks/useUser";

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
  entityToken?: string;
}

const ChatUserRegisterPanel: React.FC<Props> = ({ onSuccess, onShowLogin, entityToken }) => {
  const { refreshUser } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accepted) {
      setError("Debés aceptar los Términos y Condiciones.");
      return;
    }
    setLoading(true);
    try {
      let avatarUrl = null;
      if (avatarFile) {
        // En un caso real, aquí subiríamos el archivo al backend
        // y obtendríamos la URL. Por ahora, simulamos.
        console.log("Simulating avatar upload...");
        avatarUrl = avatar; // Usamos la URL local como placeholder
      }

      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim(),
        password,
        acepto_terminos: accepted,
        avatarUrl,
      };
      if (phone.trim()) payload.telefono = phone.trim();

      let currentEntityToken = entityToken || safeLocalStorage.getItem("entityToken");
      if (!currentEntityToken) {
        const params = new URLSearchParams(window.location.search);
        currentEntityToken = params.get('token');
      }
      if (!currentEntityToken) {
        setError("El token de la entidad es requerido.");
        setLoading(false);
        return;
      }
      payload.empresa_token = currentEntityToken;

      const anon = safeLocalStorage.getItem("anon_id");
      if (anon) payload.anon_id = anon;

      const data = await apiFetch<RegisterResponse>("/chatuserregisterpanel", {
        method: "POST",
        body: payload,
        skipAuth: true,
      });
      safeLocalStorage.setItem("authToken", data.token);
      await refreshUser();
      onSuccess(data.rol);
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex justify-center">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="relative group">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={avatar || undefined} />
                    <AvatarFallback className="bg-muted">
                        <UserIcon className="h-12 w-12 text-muted-foreground" />
                    </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="h-8 w-8 text-white" />
                </div>
            </button>
        </div>
        <Input
          ref={nameRef}
          type="text"
          placeholder="Nombre y apellido"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <Input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
        />
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="terms"
            checked={accepted}
            onChange={() => setAccepted(!accepted)}
            required
            className="form-checkbox h-4 w-4 text-primary"
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground">
            Acepto los <a href="/legal/terms" target="_blank" className="underline text-primary">Términos</a> y <a href="/legal/privacy" target="_blank" className="underline text-primary">Política de Privacidad</a>.
          </label>
        </div>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Registrando..." : "Registrarme"}
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
