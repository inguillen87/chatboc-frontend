import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start w-full px-4 py-2">
      <div className="flex items-center space-x-1 px-4 py-2 bg-blue-100 text-[#006AEC] rounded-2xl shadow-sm text-sm">
        <span className="animate-bounce">●</span>
        <span className="animate-bounce delay-150">●</span>
        <span className="animate-bounce delay-300">●</span>
      </div>
    </div>
  );
};

export default TypingIndicator;
