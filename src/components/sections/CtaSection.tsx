import React from "react";
import { Bot, MessageSquareHeart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const CtaSection = () => {
  const navigate = useNavigate();
  const openSalesWhatsApp = () => {
    window.open(
      "https://wa.me/5492613168608?text=Hola!%20Quiero%20ver%20Chatboc%20para%20mi%20organizacion",
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section
      id="cta"
      aria-labelledby="landing-cta-title"
      className="bg-background py-16 text-foreground md:py-24"
    >
      <div className="container mx-auto px-4">
        <div className="chatboc-command-shell mx-auto max-w-5xl overflow-hidden p-6 text-center md:p-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
            <Bot className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id="landing-cta-title" className="mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-normal md:text-5xl">
            Convertí atención, ventas y soporte en una operación conectada
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
            Probá una demo, hablá con un asesor o creá tu cuenta para conocer un recorrido simple, claro y listo para operar.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="chatboc-cta-primary h-12 w-full rounded-[8px] font-semibold sm:w-auto"
              onClick={() => navigate("/demo")}
            >
              <Bot className="mr-2 h-5 w-5" aria-hidden="true" />
              Ver demo
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full rounded-[8px] border-border/80 font-semibold hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
              onClick={openSalesWhatsApp}
            >
              <MessageSquareHeart className="mr-2 h-5 w-5" aria-hidden="true" />
              Hablar con un asesor
            </Button>

            <Button
              size="lg"
              variant="secondary"
              className="h-12 w-full rounded-[8px] border border-border/70 bg-card font-semibold shadow-sm hover:bg-accent sm:w-auto"
              onClick={() => navigate("/register")}
            >
              <UserPlus className="mr-2 h-5 w-5" aria-hidden="true" />
              Crear cuenta
            </Button>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="mt-7 text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Ya tengo cuenta, iniciar sesión
          </button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
