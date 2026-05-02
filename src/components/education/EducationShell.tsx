import React from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEducationShellData } from "@/hooks/useEducationShellData";
import type { EducationPersona } from "@/types/education";
import { isEducationFlagEnabled } from "@/config/featureFlags";

interface EducationShellProps {
  persona: EducationPersona;
  children: React.ReactNode;
}

export default function EducationShell({ persona, children }: EducationShellProps) {
  const location = useLocation();
  const { data } = useEducationShellData(persona);

  const navFromBackend = Array.isArray(data?.nav_items) ? data.nav_items : [];
  const navItems = navFromBackend.filter((item) => {
    if (!item.enabledFlag) return true;
    return isEducationFlagEnabled(item.enabledFlag);
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <header className="chatboc-landing-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Vertical educación</p>
              <h1 className="text-2xl font-bold tracking-normal text-foreground">{data?.title || "Portal educativo"}</h1>
              {data?.subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{data.subtitle}</p> : null}
            </div>
          </div>
        </div>

        {navItems.length > 0 ? (
          <nav className="mt-5 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button asChild size="sm" variant={isActive ? "default" : "outline"} key={item.key} className="rounded-[8px]">
                  <Link to={item.path}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>
        ) : null}
      </header>
      {children}
    </div>
  );
}
