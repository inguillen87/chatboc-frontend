import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Pantalla para direcciones que no existen o que la cuenta actual no puede
 * abrir. Es neutra a propósito: no nombra a la plataforma (marca blanca) y no
 * distingue "no existe" de "sin permiso", para no revelar pantallas privadas.
 */
const NotFound = () => {
  const navigate = useNavigate();
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          No encontramos esta página
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Puede que la dirección esté mal escrita, que la página se haya movido o que tu cuenta no tenga acceso a ella.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {canGoBack && (
            <Button type="button" onClick={() => navigate(-1)}>
              Volver atrás
            </Button>
          )}
          <Button asChild variant={canGoBack ? "outline" : "default"}>
            <Link to="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
