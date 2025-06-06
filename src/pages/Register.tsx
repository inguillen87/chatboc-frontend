// Contenido COMPLETO para: Register.tsx

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/utils/api';
import { useNavigate } from 'react-router-dom';

interface Rubro { id: number; nombre: string; }
interface RegisterResponse { id: number; token: string; name: string; email: string; }

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubro, setRubro] = useState(''); // Cambiado a string para el nombre
  const [rubrosDisponibles, setRubrosDisponibles] = useState<Rubro[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await apiFetch<Rubro[]>('/rubros');
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

    try {
      const payload = {
        name, email, password, nombre_empresa: nombreEmpresa,
        rubro: rubro, // Enviamos el nombre del rubro
        acepto_terminos: accepted,
      };
      
      const data = await apiFetch<RegisterResponse>('/register', { method: 'POST', body: payload });

      // --- CORRECCIÓN DEFINITIVA ---
      localStorage.setItem('authToken', data.token);

      const userProfile = {
        id: data.id,
        name: data.name,
        email: data.email,
      };
      localStorage.setItem('user', JSON.stringify(userProfile));

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
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-white dark:bg-[#0f0f0f]">
      <div className="w-full max-w-md bg-gray-100 dark:bg-[#1a1a1a] p-8 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center">Registrarse</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
          <Input type="text" placeholder="Nombre de la empresa" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required disabled={isLoading} />
          <select value={rubro} onChange={(e) => setRubro(e.target.value)} required disabled={isLoading} className="w-full p-2 border rounded text-sm bg-white dark:bg-gray-800 text-black dark:text-white">
            <option value="">Seleccioná tu rubro</option>
            {rubrosDisponibles.map((r) => (<option key={r.id} value={r.nombre}>{r.nombre}</option>))}
          </select>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="terms" checked={accepted} onChange={() => setAccepted(!accepted)} required disabled={isLoading} />
            <label htmlFor="terms" className="text-xs">Acepto los <a href="/legal/terms" target="_blank" className="underline">Términos</a> y <a href="/legal/privacy" target="_blank" className="underline">Política de Privacidad</a>.</label>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={!accepted || isLoading}>
            {isLoading ? "Registrando..." : "Registrarse"}
          </Button>
        </form>
        <div className="text-center text-sm mt-4">
          ¿Ya tenés cuenta?{' '}
          <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline">Iniciar sesión</button>
        </div>
      </div>
    </div>
  );
};

export default Register;