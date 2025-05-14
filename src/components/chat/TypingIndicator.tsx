import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-2 px-4 py-2">
      <div className="flex items-center justify-center space-x-1 bg-gray-100 px-3 py-2 rounded-xl shadow-sm">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0s]" />
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.15s]" />
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.3s]" />
      </div>
    </div>
  );
};

export default TypingIndicator;
