import React from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';

const ClerkSsoCallbackPage: React.FC = () => {
  const clerkRuntime = useClerkRuntime();
  const unavailable = !clerkRuntime.loading && !clerkRuntime.enabled;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-100">Chatboc Auth</p>
            <h1 className="text-xl font-bold">Validando acceso seguro</h1>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
          {unavailable ? (
            <p role="alert">
              No pudimos validar la configuracion de acceso. Volve al inicio de sesion e intenta nuevamente.
            </p>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
              Conectando tu cuenta social con el CRM y el tenant.
            </>
          )}
        </div>
        {clerkRuntime.enabled ? <AuthenticateWithRedirectCallback /> : null}
      </section>
    </main>
  );
};

export default ClerkSsoCallbackPage;
