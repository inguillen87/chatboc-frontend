import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const plan = searchParams.get("plan");

  const planInfo = {
    pro: {
      title: "Plan Pro",
      price: "$300.000 / mes",
      benefits: [
        "Hasta 250 preguntas e interacciones personalizadas por mes",
        "Entrenamiento optimizado para el rubro de tu empresa",
        "Panel de control con métricas e historial de uso",
        "Asistente inteligente con aprendizaje y mejoras continuas",
        "Alertas automáticas por palabra clave (ej: reclamos, urgencias)",
        "CRM integrado y registro automático de conversaciones",
        "Integraciones esenciales con formularios, catálogos y email",
        "Soporte técnico prioritario y acceso anticipado a nuevas funcionalidades"
      ],
    },
    full: {
      title: "Plan Full",
      price: "$350.000 / mes",
      benefits: [
        "Consultas ilimitadas sin tope de mensajes",
        "Automatización completa de respuestas, seguimientos y derivaciones",
        "Envío automático de catálogos, promociones o formularios por email",
        "Integración avanzada con herramientas externas (ERP, CRM, GovTech, BI)",
        "Acceso a panel administrativo completo con historial y métricas",
        "Dashboard mensual con indicadores de rendimiento del chatbot",
        "Soporte para empresas con múltiples unidades de negocio o servicios diferenciados",
        "Soporte técnico dedicado, onboarding y consultoría especializada"
      ],
    },
  };

  const selected = planInfo[plan as "pro" | "full"];

  if (!selected) {
    return (
      <div className="text-center mt-20 bg-background text-foreground"> {/* Añadido bg-background y text-foreground */}
        <h2 className="text-xl font-bold">❌ Plan no válido</h2>
        <Button onClick={() => navigate("/perfil")} className="mt-4">
          Volver al perfil
        </Button>
      </div>
    );
  }

  return (
    // Añadido bg-background y text-foreground para asegurar coherencia
    <div className="max-w-2xl mx-auto px-4 py-20 text-center bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-2">{selected.title}</h1>
      <p className="text-muted-foreground mb-4">{selected.price}</p>

      <ul className="text-left mb-6 space-y-2">
        {selected.benefits.map((b, i) => (
          <li key={i} className="text-sm">✅ {b}</li>
        ))}
      </ul>

      <Button
        className="bg-green-600 hover:bg-green-700 text-white font-semibold"
        onClick={() =>
          window.open(
            `https://wa.me/5492613168608?text=Hola! Quiero activar el ${selected.title} de Chatboc.`,
            "_blank"
          )
        }
      >
        Solicitar activación por WhatsApp
      </Button>

      {/* Hidden button for demo flow simulation */}
      <Button
         variant="outline"
         className="mt-4 w-full"
         onClick={() => {
            const path = window.location.pathname;
            const slug = path.split('/')[2]; // /demo/:slug/checkout
            if (slug) {
                // If in demo mode, redirect to portal after "purchase"
                window.location.href = `/demo/${slug}/portal`;
            } else {
                 navigate("/perfil");
            }
         }}
      >
        Simular Compra (Demo)
      </Button>

      <p className="text-xs text-muted-foreground mt-3">
        También podés escribirnos a info@chatboc.ar
      </p>
    </div>
  );
};

export default Checkout;