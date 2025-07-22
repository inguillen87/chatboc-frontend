// src/components/chat/AnonRegisterForm.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AnonRegisterFormProps {
  onRegister: (data: { nombre: string; telefono: string }) => void;
}

const AnonRegisterForm: React.FC<AnonRegisterFormProps> = ({ onRegister }) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre && telefono) {
      onRegister({ nombre, telefono });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          required
        />
      </div>
      <div>
        <Label htmlFor="telefono">Teléfono</Label>
        <Input
          id="telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Tu número de teléfono"
          required
        />
      </div>
      <Button type="submit" className="w-full">Registrarse y continuar</Button>
    </form>
  );
};

export default AnonRegisterForm;
