import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEducationShellData } from '@/hooks/useEducationShellData';
import type { EducationPersona } from '@/types/education';
import {
  EDUCATION_FEATURE_FLAGS,
  isEducationFlagEnabled,
} from '@/config/featureFlags';

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
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Vertical educación</p>
            <h1 className="text-xl font-semibold">{data?.title || 'Portal educativo'}</h1>
            {data?.subtitle ? <p className="text-sm text-muted-foreground">{data.subtitle}</p> : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Flags activas: {Object.entries(EDUCATION_FEATURE_FLAGS).filter(([, enabled]) => enabled).length}
          </div>
        </div>
        {navItems.length > 0 ? (
          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button asChild size="sm" variant={isActive ? 'default' : 'outline'} key={item.key}>
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
