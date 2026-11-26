import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bot, MessageSquareHeart, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import BrandBotAvatar from "@/components/chat/BrandBotAvatar";

const CTA_BOT_PALETTE = ["#0D35C3", "#2563EB", "#06B6D4", "#10B981"];

const CtaSection = () => {
  const navigate = useNavigate();
  const reduceMotion = Boolean(useReducedMotion());
  // One orchestrated moment lives in the hero; sections below stay still.
  const canAnimateInView = false && !reduceMotion;

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
      className="bg-background py-20 text-foreground md:py-28"
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={canAnimateInView ? { opacity: 0.96, y: 18 } : false}
          whileInView={canAnimateInView ? { opacity: 1, y: 0 } : undefined}
          viewport={canAnimateInView ? { once: true, amount: 0.25 } : undefined}
          transition={{ duration: canAnimateInView ? 0.45 : 0, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[26px] border border-primary/25 bg-card p-8 text-center shadow-[0_32px_90px_rgba(15,23,42,0.14)] dark:border-primary/30 dark:shadow-[0_32px_90px_rgba(0,0,0,0.48)] md:p-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-75 dark:opacity-55"
            style={{
              background:
                "radial-gradient(circle at 14% 18%, rgba(37, 99, 235, 0.16), transparent 38%), radial-gradient(circle at 86% 24%, rgba(6, 182, 212, 0.15), transparent 36%), radial-gradient(circle at 52% 94%, rgba(16, 185, 129, 0.14), transparent 40%)",
            }}
          />

          <div className="relative">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-background/90 shadow-md">
              <BrandBotAvatar
                palette={CTA_BOT_PALETTE}
                state="idle"
                size={46}
                reducedMotion={reduceMotion}
              />
            </div>

            <h2
              id="landing-cta-title"
              className="mx-auto max-w-3xl text-balance text-3xl font-bold leading-tight tracking-[-0.025em] md:text-5xl"
            >
              Convertí atención, ventas y soporte en una operación conectada
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Probá una demo, hablá con alguien del equipo o creá tu cuenta para verlo funcionando con tu marca.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="chatboc-cta-primary h-12 w-full rounded-[10px] px-6 font-semibold shadow-md sm:w-auto"
                onClick={() => navigate("/demo")}
              >
                <Bot className="mr-2 h-5 w-5" aria-hidden="true" />
                Ver demo
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-[10px] border-border/80 bg-background/85 px-6 font-semibold hover:border-primary/45 hover:bg-primary/5 sm:w-auto"
                onClick={openSalesWhatsApp}
              >
                <MessageSquareHeart className="mr-2 h-5 w-5" aria-hidden="true" />
                Hablar con un asesor
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="h-12 w-full rounded-[10px] border border-border/75 bg-card px-6 font-semibold shadow-sm hover:bg-accent sm:w-auto"
                onClick={() => navigate("/register")}
              >
                <UserPlus className="mr-2 h-5 w-5" aria-hidden="true" />
                Crear cuenta
              </Button>
            </div>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-7 text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Ya tengo cuenta, iniciar sesión
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaSection;
