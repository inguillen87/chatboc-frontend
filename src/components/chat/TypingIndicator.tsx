import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center px-4 py-2">
      {/* Icono/avatar opcional */}
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-2 border border-blue-200 dark:border-blue-800 shadow">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="10" fill="#3B82F6" fillOpacity="0.8" />
          <circle cx="7" cy="10" r="1.5" fill="#fff" />
          <circle cx="10" cy="10" r="1.5" fill="#fff" />
          <circle cx="13" cy="10" r="1.5" fill="#fff" />
        </svg>
      </span>
      {/* Animación de los 3 puntitos usando Tailwind */}
      <div className="bg-blue-100 dark:bg-blue-900 px-4 py-2 rounded-2xl shadow text-blue-900 dark:text-blue-50 flex items-center gap-1">
        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full opacity-70 animate-bounce" style={{ animationDelay: "0s" }}></span>
        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full opacity-70 animate-bounce" style={{ animationDelay: "0.15s" }}></span>
        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full opacity-70 animate-bounce" style={{ animationDelay: "0.3s" }}></span>
      </div>
    </div>
  );
};

export default TypingIndicator;
