import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/utils/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = await apiFetch('/login', 'POST', { email, password });

      if (data && data.token) {
        // Guardar usuario en localStorage
        localStorage.setItem('user', JSON.stringify(data));
        // Redirigir al perfil
        navigate('/perfil');
      } else {
        setError('Credenciales inválidas.');
      }
    } catch (err) {
      console.error('❌ Error al iniciar sesión:', err);
      setError('Error de conexión con el servidor.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Iniciar Sesión
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full">
            Iniciar Sesión
          </Button>
        </form>
        <div className="text-center text-sm text-gray-600 mt-4">
          ¿No tenés cuenta?{' '}
          <button
            onClick={() => navigate('/register')}
            className="text-blue-600 hover:underline"
          >
            Registrate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
