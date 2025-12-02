import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { submitTenantTicket } from '@/api/tenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/api';

const TenantTicketFormPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const tenantName = tenant?.nombre ?? 'este espacio';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slug) {
      toast({
        title: 'Seleccioná un espacio',
        description: 'Elegí un espacio desde el encabezado antes de enviar un reclamo.',
        variant: 'destructive',
      });
      return;
    }

    if (!descripcion.trim()) {
      toast({
        title: 'La descripción es obligatoria',
        description: 'Contanos qué ocurrió para poder ayudarte.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        categoria: categoria.trim() || undefined,
        descripcion: descripcion.trim(),
        lat: lat.trim() ? Number(lat) : undefined,
        lng: lng.trim() ? Number(lng) : undefined,
      };
      await submitTenantTicket(slug, payload);
      toast({
        title: 'Reclamo enviado',
        description: 'Gracias por contactarnos. Seguiremos el caso y te notificaremos cualquier novedad.',
      });
      setCategoria('');
      setDescripcion('');
      setLat('');
      setLng('');
    } catch (error) {
      toast({
        title: 'No pudimos enviar tu reclamo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio para registrar reclamos, sugerencias o consultas.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Nuevo reclamo o solicitud</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El equipo de {tenantName} recibirá este reporte de inmediato. Cuantos más detalles compartas, más rápido podrán resolverlo.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="categoria">Tema o categoría (opcional)</Label>
                <Input
                  id="categoria"
                  value={categoria}
                  onChange={(event) => setCategoria(event.target.value)}
                  placeholder="Ej: Iluminación, Comercio, Espacio público"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Describí qué ocurrió, dónde y cuándo. Podés sumar datos de contacto si querés seguimiento personalizado."
                  rows={6}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitud (opcional)</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(event) => setLat(event.target.value)}
                    placeholder="-34.6083"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitud (opcional)</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(event) => setLng(event.target.value)}
                    placeholder="-58.3712"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar reclamo
                </Button>
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => {
                  setCategoria('');
                  setDescripcion('');
                  setLat('');
                  setLng('');
                }}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </TenantShell>
  );
};

export default TenantTicketFormPage;
