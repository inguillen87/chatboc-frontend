import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

interface DemoCtaBannerProps {
  show: boolean;
}

const DemoCtaBanner: React.FC<DemoCtaBannerProps> = ({ show }) => {
  const [visible, setVisible] = useState(false);
  const { tenant } = useTenant();

  const isMunicipio = tenant?.tipo === 'municipio' || tenant?.slug?.includes('municipio') || tenant?.slug?.includes('gobierno');

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setVisible(true), 400); // leve delay opcional
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  const title = isMunicipio ? "¿Querés modernizar tu municipio?" : "¿Querés implementar Chatboc?";
  const subtitle = isMunicipio ? "Mejorá la atención al vecino hoy mismo." : "Usalo en tu empresa o escribinos ahora.";
  const ctaText = isMunicipio ? "Usar en mi gobierno" : "Usar Chatboc en mi empresa";
  const waMessage = isMunicipio
    ? "Hola! Estoy probando la demo de gobierno y quiero implementar Chatboc en mi municipio."
    : "Hola! Estoy probando Chatboc y quiero implementarlo en mi empresa.";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 max-w-sm p-4 rounded-xl border shadow-lg bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white">
            {title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {subtitle}
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
          {ctaText}
        </button>
        <button
          onClick={() =>
            window.open(
              `https://wa.me/5492613168608?text=${encodeURIComponent(waMessage)}`,
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
