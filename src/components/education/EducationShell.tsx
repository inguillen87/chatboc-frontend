import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEducationShellData } from '@/hooks/useEducationShellData';
import type { EducationPersona } from '@/types/education';
import {
  EDUCATION_FEATURE_FLAGS,
  isEducationFlagEnabled,
  type EducationFeatureFlag,
} from '@/config/featureFlags';

interface EducationShellProps {
  persona: EducationPersona;
  children: React.ReactNode;
}

const defaultNavByPersona: Record<EducationPersona, Array<{ key: string; label: string; path: string; enabledFlag?: EducationFeatureFlag }>> = {
  public: [{ key: 'help', label: 'Ayuda', path: '/educacion' }],
  family: [
    { key: 'home', label: 'Inicio', path: '/educacion/familia' },
    { key: 'attendance', label: 'Asistencia', path: '/educacion/familia/asistencia', enabledFlag: 'attendance_enabled' },
    { key: 'documents', label: 'Documentos', path: '/educacion/familia/documentos', enabledFlag: 'documents_enabled' },
  ],
  staff: [
    { key: 'inbox', label: 'Inbox', path: '/educacion/staff/inbox' },
    { key: 'admissions', label: 'Admisiones', path: '/educacion/staff/admisiones', enabledFlag: 'admissions_enabled' },
    { key: 'billing', label: 'Cobranza', path: '/educacion/staff/cobranzas', enabledFlag: 'billing_enabled' },
  ],
};

export default function EducationShell({ persona, children }: EducationShellProps) {
  const location = useLocation();
  const { data } = useEducationShellData(persona);

  const navFromBackend = Array.isArray(data?.nav_items) ? data.nav_items : [];
  const sourceNav = navFromBackend.length > 0 ? navFromBackend : defaultNavByPersona[persona];
  const navItems = sourceNav.filter((item) => {
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
      </header>
      {children}
    </div>
  );
}
