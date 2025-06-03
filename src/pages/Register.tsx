import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/utils/api';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [rubroId, setRubroId] = useState('');
  const [rubrosDisponibles, setRubrosDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRubros = async () => {
      try {
        const data = await apiFetch('/rubros', 'GET');
        if (Array.isArray(data.rubros)) {
          setRubrosDisponibles(data.rubros);
        }
      } catch (err) {
        console.error('❌ Error al cargar rubros:', err);
      }
    };
    fetchRubros();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!accepted) {
      setError("Debés aceptar los Términos y Condiciones para continuar.");
      return;
    }
    try {
      const payload = {
        name,
        email,
        password,
        nombre_empresa: nombreEmpresa,
        rubro: rubrosDisponibles.find(r => r.id === parseInt(rubroId))?.nombre || '',
        acepto_terminos: accepted,
        fecha_aceptacion_terminos: accepted ? new Date().toISOString() : null,
      };

      const data = await apiFetch('/register', 'POST', payload);

      if (data?.token && data?.email && data?.plan) {
        const user = {
          token: data.token,
          name: data.name,
          email: data.email,
          plan: data.plan,
          nombre_empresa: data.nombre_empresa,
          rubro_id: data.rubro_id,
          preguntas_usadas: data.preguntas_usadas ?? 0,
          limite_preguntas: data.limite_preguntas ?? 50,
        };
        localStorage.setItem('user', JSON.stringify(user));
        navigate('/perfil');
      } else {
        setError('❌ Error al registrarse. Verificá los datos.');
      }
    } catch (err) {
      console.error('❌ Error al registrarse:', err);
      setError('⚠️ No se pudo completar el registro.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-white dark:bg-[#0f0f0f] transition-colors">
      <div className="w-full max-w-md bg-gray-100 dark:bg-[#1a1a1a] p-8 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
          Registrarse
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input type="text" placeholder="Nombre de la empresa (fantasía o legal)" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} required />

          <select
            value={rubroId}
            onChange={(e) => setRubroId(e.target.value)}
            required
            className="w-full p-2 border rounded text-sm bg-white dark:bg-[#0f0f0f] text-black dark:text-white"
          >
            <option value="">Seleccioná tu rubro</option>
            {rubrosDisponibles.map((rubro) => (
              <option key={rubro.id} value={rubro.id}>{rubro.nombre}</option>
            ))}
          </select>

          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            ⚠️ Es muy importante ingresar correctamente el nombre de tu empresa y seleccionar el rubro real, ya que esto mejora la experiencia del usuario y permite que el bot responda con mayor precisión.
          </p>

          {/* Checkbox Términos */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="terms"
              checked={accepted}
              onChange={() => setAccepted(!accepted)}
              className="accent-blue-600 h-4 w-4"
              required
            />
            <label htmlFor="terms" className="text-xs text-gray-700 dark:text-gray-200">
              Acepto los{" "}
              <a href="/legal/terms" target="_blank" className="underline text-blue-600 dark:text-blue-400">Términos y Condiciones</a>
              {" "}y la{" "}
              <a href="/legal/privacy" target="_blank" className="underline text-blue-600 dark:text-blue-400">Política de Privacidad</a>.
            </label>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={!accepted}>
            Registrarse
          </Button>
        </form>
        <div className="text-center text-sm text-gray-700 dark:text-gray-300 mt-4">
          ¿Ya tenés cuenta?{' '}
          <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline dark:text-blue-400">
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
