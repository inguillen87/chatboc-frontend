import React from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { Facebook, Linkedin, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import { cn } from '@/lib/utils';

interface ClerkAuthButtonsProps {
  mode?: 'login' | 'register';
  className?: string;
}

const ClerkAuthButtons: React.FC<ClerkAuthButtonsProps> = ({ mode = 'login', className }) => {
  const clerkRuntime = useClerkRuntime();

  if (!clerkRuntime.enabled) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <SignedOut>
        <div className="grid gap-2">
          <SignInButton mode="modal">
            <Button type="button" variant="outline" className="h-11 w-full justify-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {mode === 'register' ? 'Crear cuenta segura' : 'Ingresar con cuenta segura'}
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button type="button" className="h-11 w-full justify-center gap-2">
              <Facebook className="h-4 w-4" />
              <Linkedin className="h-4 w-4" />
              Facebook, LinkedIn o email
            </Button>
          </SignUpButton>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-foreground">Cuenta conectada</span>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </SignedIn>
    </div>
  );
};

export default ClerkAuthButtons;
