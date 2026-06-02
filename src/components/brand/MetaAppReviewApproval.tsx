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
        "inline-flex max-w-full items-center gap-2 rounded-full border border-[#0866ff]/25 bg-background/75 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur",
        isHero ? "w-fit" : "w-full justify-between",
        className,
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0866ff]/10 text-[#0866ff] ring-1 ring-[#0866ff]/20">
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 truncate font-semibold">
        Chatboc.ar verificado por Meta como proveedor de tecnologia
      </span>
      <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300 sm:inline-flex">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        WhatsApp Business Platform
      </span>
    </aside>
  );
};

export default MetaAppReviewApproval;
