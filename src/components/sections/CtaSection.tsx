import React from "react";
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
      className="border-t border-border bg-background py-20 text-foreground md:py-28"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12">
          <div>
            <h2 id="landing-cta-title" className="chatboc-section-heading text-balance">
              Convertí atención, ventas y soporte en una operación conectada
            </h2>
            <p className="chatboc-section-copy mt-4 max-w-xl">
              Probá una demo, hablá con alguien del equipo o creá tu cuenta para verlo funcionando con tu marca.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap lg:flex-nowrap lg:justify-end">
              <Button
                size="lg"
                className="chatboc-cta-primary h-11 w-full rounded-[8px] px-6 font-semibold shadow-none sm:w-auto"
                onClick={() => navigate("/demo")}
              >
                Ver demo
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-[8px] border-border bg-background px-6 font-semibold hover:bg-muted/50 sm:w-auto"
                onClick={openSalesWhatsApp}
              >
                Hablar con un asesor
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-[8px] border-border bg-background px-6 font-semibold hover:bg-muted/50 sm:w-auto"
                onClick={() => navigate("/register")}
              >
                Crear cuenta
              </Button>
            </div>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="rounded-[4px] text-sm font-medium text-slate-600 underline underline-offset-4 transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-muted-foreground"
            >
              Ya tengo cuenta, iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
