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
      price: "$30 / mes",
      benefits: [
        "Hasta 200 preguntas y respuestas personalizadas por mes",
        "Entrenamiento optimizado para el rubro de tu empresa",
        "Panel de control con métricas e historial de uso",
        "Asistente inteligente con aprendizaje y mejoras continuas",
        "Alertas automáticas por palabra clave (ej: reclamos, urgencias)",
        "Registro automático de conversaciones (planilla o sistema)",
        "Soporte técnico prioritario y acceso anticipado a nuevas funcionalidades"
      ],
    },
    full: {
      title: "Plan Full",
      price: "$80 / mes",
      benefits: [
        "Consultas ilimitadas",
        "Automatización completa de respuestas, seguimientos y derivaciones",
        "Envío automático de catálogos, promociones o formularios por email",
        "Integración con herramientas externas (CRM, planillas, formularios, etc.)",
        "Acceso a panel administrativo completo con historial y métricas",
        "Dashboard mensual con indicadores de rendimiento del chatbot",
        "Soporte para empresas con múltiples unidades de negocio o servicios diferenciados",
        "Soporte técnico dedicado y configuración avanzada incluida"
      ],
    },
  };

  const selected = planInfo[plan as "pro" | "full"];

  if (!selected) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-xl font-bold">❌ Plan no válido</h2>
        <Button onClick={() => navigate("/perfil")} className="mt-4">
          Volver al perfil
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
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

      <p className="text-xs text-muted-foreground mt-3">
        También podés escribirnos a info@chatboc.ar
      </p>
    </div>
  );
};

export default Checkout;
