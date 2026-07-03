import React from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { Loader2, ShieldCheck } from 'lucide-react';

const ClerkSsoCallbackPage: React.FC = () => (
  <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
    <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-100">Chatboc Auth</p>
          <h1 className="text-xl font-bold">Validando acceso seguro</h1>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
        <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
        Conectando tu cuenta social con el CRM y el tenant.
      </div>
      <AuthenticateWithRedirectCallback />
    </section>
  </main>
);

export default ClerkSsoCallbackPage;
