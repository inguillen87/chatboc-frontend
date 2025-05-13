import { useEffect, useState } from "react";

interface DemoCtaBannerProps {
  show: boolean;
}

const DemoCtaBanner: React.FC<DemoCtaBannerProps> = ({ show }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setVisible(true), 500); // leve delay opcional
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white border border-blue-200 rounded-xl shadow-lg p-4 w-72 max-w-sm animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            ¿Querés implementar Chatboc?
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Usalo en tu empresa o escribinos ahora.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={() => window.location.href = '/demo'}
          className="bg-blue-600 text-white text-sm rounded-md px-3 py-2 hover:bg-blue-700 transition"
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
          className="border border-blue-600 text-blue-600 text-sm rounded-md px-3 py-2 hover:bg-blue-50 transition"
        >
          Hablar por WhatsApp
        </button>
      </div>
    </div>
  );
};

export default DemoCtaBanner;
