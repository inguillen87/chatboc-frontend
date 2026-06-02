import React from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type MetaAppReviewApprovalVariant = "hero" | "compact";

interface MetaAppReviewApprovalProps {
  className?: string;
  variant?: MetaAppReviewApprovalVariant;
}

const MetaAppReviewApproval = ({
  className,
  variant = "compact",
}: MetaAppReviewApprovalProps) => {
  const isHero = variant === "hero";

  return (
    <aside
      aria-label="Proveedor tecnologico verificado por Meta"
      className={cn(
        "inline-flex max-w-full items-center gap-3 rounded-[14px] border border-[#0866ff]/35 bg-[linear-gradient(90deg,rgba(8,102,255,0.16),rgba(37,211,102,0.10),rgba(255,255,255,0.78))] px-4 py-3 text-left text-foreground shadow-[0_18px_44px_rgba(8,102,255,0.16)] backdrop-blur dark:bg-[linear-gradient(90deg,rgba(8,102,255,0.18),rgba(37,211,102,0.10),rgba(8,102,255,0.08))]",
        isHero ? "w-full max-w-[680px]" : "w-full justify-between",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0866ff]/15 text-[#0866ff] ring-1 ring-[#0866ff]/35 dark:text-[#69a8ff]">
        <BadgeCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-[#0866ff] dark:text-sky-200">
          Hito oficial Meta
        </span>
        <span className="block text-base font-black leading-tight text-foreground sm:text-lg">
          Chatboc.ar verificado por Meta
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-xs font-bold leading-snug text-emerald-700 dark:text-emerald-300 sm:text-sm">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Proveedor de tecnologia para WhatsApp Business Platform
        </span>
      </span>
    </aside>
  );
};

export default MetaAppReviewApproval;
