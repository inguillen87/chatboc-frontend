import React, { useMemo } from 'react';
import ChatWidget from '@/components/chat/ChatWidget';

const EmbedPage = () => {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const primaryColor = query.get('primaryColor');
  const logoUrl = query.get('logoUrl');
  const position = query.get('position');

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ChatWidget
        primaryColor={primaryColor}
        logoUrl={logoUrl}
        position={position}
      />
    </div>
  );
};

export default EmbedPage;
