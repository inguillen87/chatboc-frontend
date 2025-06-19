import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useUser } from '@/hooks/useUser';

interface RegisterResponse {
  id: number;
  token: string;
  name: string;
  email: string;
  tipo_chat?: 'pyme' | 'municipio';
}

interface Props {
  onSuccess: () => void;
}

const ChatRegisterPanel: React.FC<Props> = ({ onSuccess }) => {
  const { setUser } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        name,
        email,
        password,
      };
      if (phone) payload.telefono = phone;
      const data = await apiFetch<RegisterResponse>('/register', {
        method: 'POST',
        body: payload,
      });
      safeLocalStorage.setItem('authToken', data.token);
      let finalTipo = data.tipo_chat;
      try {
        const me = await apiFetch<any>('/me');
        finalTipo = me?.tipo_chat || finalTipo;
        const profile = {
          id: data.id,
          name: data.name,
          email: data.email,
          token: data.token,
          rubro: me?.rubro?.toLowerCase() || '',
          tipo_chat: finalTipo || 'pyme',
        };
        safeLocalStorage.setItem('user', JSON.stringify(profile));
        setUser(profile);
      } catch {
        /* ignore */
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error || 'Error de registro');
      } else {
        setError('No se pudo completar el registro');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-3 w-full max-w-sm mx-auto">
      <h2 className="text-lg font-bold text-center">Registro</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="text"
          placeholder="Nombre y apellido"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrarme y continuar'}
        </Button>
      </form>
    </div>
  );
};

export default ChatRegisterPanel;
