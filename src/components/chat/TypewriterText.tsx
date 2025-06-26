import React, { useState, useEffect } from 'react';

interface Props {
  html: string;
  speed?: number;
  className?: string;
}

const TypewriterText: React.FC<Props> = ({ html, speed = 20, className }) => {
  const [visible, setVisible] = useState('');

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisible(html.slice(0, i));
      if (i >= html.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [html, speed]);

  return <span className={className} dangerouslySetInnerHTML={{ __html: visible }} />;
};

export default TypewriterText;
