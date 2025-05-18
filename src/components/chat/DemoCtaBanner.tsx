import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface DemoCtaBannerProps {
  show: boolean;
}

const DemoCtaBanner: React.FC<DemoCtaBannerProps> = ({ show }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setVisible(true), 400); // leve delay opcional
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 max-w-sm p-4 rounded-xl border shadow-lg bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">
            ¿Querés implementar Chatboc?
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Usalo en tu empresa o escribinos ahora.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={() => window.location.href = '/demo'}
          className="bg-[#006AEC] hover:bg-blue-700 text-white text-sm rounded-md px-3 py-2 transition font-medium"
        >
          Usar Chatboc en mi empresa
        </button>
        <button
          onClick={() =>
            window.open(
              'https://wa.me/5492613168608?text=Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.',
              '_blank'
            )
          }
          className="border border-[#006AEC] text-[#006AEC] hover:bg-blue-50 dark:hover:bg-blue-950 text-sm rounded-md px-3 py-2 transition font-medium"
        >
          Hablar por WhatsApp
        </button>
      </div>
    </div>
  );
};

export default DemoCtaBanner;
