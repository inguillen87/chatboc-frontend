// pages/iframe.tsx
import { useEffect, useState } from 'react';
import ChatWidget from '@/components/ChatWidget'; // Ajustá si tu componente tiene otro nombre o ruta

export default function IframePage() {
  const [token, setToken] = useState('');
  const [tipoChat, setTipoChat] = useState<'pyme' | 'municipio'>('pyme');
  const [rubro, setRubro] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const tipoParam = params.get('tipo_chat');
    const rubroParam = params.get('rubro');

    if (tokenParam) setToken(tokenParam);
    if (tipoParam === 'municipio' || tipoParam === 'pyme') setTipoChat(tipoParam);
    if (rubroParam) setRubro(rubroParam);
  }, []);

  if (!token) {
    return (
      <div style={{ padding: '2rem', color: '#fff', background: '#111', fontSize: '14px' }}>
        Token inválido
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', margin: 0, padding: 0 }}>
      <ChatWidget
        token={token}
        rubro={rubro}
        tipoChat={tipoChat}
        modoWidget={true}
      />
    </div>
  );
}
