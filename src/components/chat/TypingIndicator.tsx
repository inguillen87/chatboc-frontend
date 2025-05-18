import React from "react";

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start w-full px-4 py-2">
      <div className="flex items-center gap-1 px-4 py-2 rounded-2xl shadow-sm text-sm bg-blue-100 dark:bg-blue-900 text-[#006AEC] dark:text-blue-200">
        <span className="w-2 h-2 bg-current rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-150" />
        <span className="w-2 h-2 bg-current rounded-full animate-bounce delay-300" />
      </div>
    </div>
  );
};

export default TypingIndicator;
