import React from "react";
import { BadgeCheck, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type MetaAppReviewApprovalVariant = "hero" | "compact";

interface MetaAppReviewApprovalProps {
  className?: string;
  variant?: MetaAppReviewApprovalVariant;
}

const approvedPermissions = ["whatsapp_business_messaging", "whatsapp_business_management"];

const MetaAppReviewApproval = ({
  className,
  variant = "compact",
}: MetaAppReviewApprovalProps) => {
  const isHero = variant === "hero";

  return (
    <section
      aria-label="Proveedor tecnológico verificado por Meta"
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-[#0866ff]/25 bg-[linear-gradient(135deg,rgba(8,102,255,0.18),rgba(37,211,102,0.12),rgba(255,255,255,0.03))] text-foreground shadow-sm",
        isHero ? "p-5 md:p-6" : "p-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(8,102,255,0.32),transparent_58%)]" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] bg-background/80 text-[#0866ff] ring-1 ring-[#0866ff]/25">
          <BadgeCheck className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#0866ff]/25 bg-background/70 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#0866ff]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Verificado por Meta
            </p>
            <h2 className={cn("font-black leading-tight text-foreground", isHero ? "text-2xl md:text-4xl" : "text-xl")}>
              Chatboc.ar IA verificado por Meta como proveedor de tecnología
            </h2>
          </div>

          <p className={cn("max-w-4xl leading-7 text-muted-foreground", isHero ? "text-base md:text-lg" : "text-sm")}>
            Nuestro negocio figura verificado como proveedor de tecnología y la app chatboc.ar fue
            aprobada para operar capacidades de WhatsApp Business Platform: mensajería,
            administración de activos, onboarding, plantillas, números, webhooks y CRM.
          </p>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#0866ff]/25 bg-[#0866ff]/10 px-2.5 py-1 text-xs font-bold text-[#0866ff]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Access verification: verified
            </span>
            {approvedPermissions.map((permission) => (
              <span
                key={permission}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-background/70 px-2.5 py-1 text-xs font-bold text-foreground"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                {permission}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              WhatsApp Business Platform
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MetaAppReviewApproval;
