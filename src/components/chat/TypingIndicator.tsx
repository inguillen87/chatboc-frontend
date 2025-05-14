// src/components/TypingIndicator.tsx
import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start w-full my-2 px-2">
      <div className="flex items-center space-x-1 px-4 py-2 bg-gray-100 rounded-xl text-sm shadow-sm">
        <span className="animate-bounce delay-[0ms]">●</span>
        <span className="animate-bounce delay-[150ms]">●</span>
        <span className="animate-bounce delay-[300ms]">●</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
