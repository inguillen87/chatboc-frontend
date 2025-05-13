
import React from 'react';

interface ChatbocLogoProps {
  size?: number;
  className?: string;
}

const ChatbocLogo: React.FC<ChatbocLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main circle/background */}
        <circle cx="50" cy="50" r="45" fill="#0EA5E9" />
        
        {/* Chat bubble shape with mouth cutout */}
        <path 
          d="M75 42C75 29.5 64.15 21 50.5 21C36.85 21 26 29.5 26 42C26 48 29 53.5 34 56.5C33 62 28 67 28 67C28 67 39 65 46 59C47.5 59.25 49 59.5 50.5 59.5C64.15 59.5 75 51 75 42Z" 
          fill="white" 
        />

        {/* Mouth shape with lips */}
        <path 
          d="M38 42C38 42 41 48 50.5 48C60 48 63 42 63 42" 
          stroke="#0EA5E9" 
          strokeWidth="4" 
          strokeLinecap="round" 
        />
        
        {/* Upper lip */}
        <path 
          d="M38 42C42 39 47 37.5 50.5 37.5C54 37.5 59 39 63 42" 
          stroke="#0EA5E9" 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
        
        {/* Accent dots like teeth or speech elements */}
        <circle cx="42" cy="42" r="2.5" fill="#FFD700" />
        <circle cx="50.5" cy="43" r="2.5" fill="#FFD700" />
        <circle cx="59" cy="42" r="2.5" fill="#FFD700" />
        
        {/* Chat tail */}
        <path 
          d="M32 58C32 58 29 63 26 65" 
          stroke="white" 
          strokeWidth="6" 
          strokeLinecap="round" 
        />
      </svg>
    </div>
  );
};

export default ChatbocLogo;
