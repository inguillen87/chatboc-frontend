import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { tenantService } from '@/services/tenantService';
import { CreateTenantPayload } from '@/types/TenantConfig';
import useRequireRole from '@/hooks/useRequireRole';

export default function CreateTenantPage() {
  useRequireRole(['super_admin']);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateTenantPayload>({
    nombre: '',
    slug: '',
    tipo: 'municipio',
    template_key: 'municipio_default',
    plan: 'full',
    auto_assign_whatsapp_number: false,
    owner_email: '',
    owner_password: '',
  });

  const handleChange = (key: keyof CreateTenantPayload, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await tenantService.createTenant(formData);
      toast.success('Tenant creado exitosamente');
      navigate('/admin/tenants'); // Redirect to list or integration page
    } catch (error) {
      console.error(error);
      toast.error('Error al crear el tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Tenant</CardTitle>
          <CardDescription>
            Da de alta un nuevo municipio o pyme en la plataforma.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre / Razón Social</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL identifier)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange('slug', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Tenant</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(val) => handleChange('tipo', val)}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="municipio">Municipio</SelectItem>
                    <SelectItem value="pyme">Pyme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">Plantilla Base</Label>
                <Select
                  value={formData.template_key}
                  onValueChange={(val) => handleChange('template_key', val)}
                >
                  <SelectTrigger id="template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="municipio_default">Municipio Default</SelectItem>
                    <SelectItem value="municipio_junin_default">Municipio Junín</SelectItem>
                    <SelectItem value="pyme_default">Pyme Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
                <Label>Credenciales del Administrador (Owner)</Label>
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        placeholder="Email"
                        type="email"
                        value={formData.owner_email || ''}
                        onChange={(e) => handleChange('owner_email', e.target.value)}
                    />
                    <Input
                        placeholder="Password"
                        type="password"
                        value={formData.owner_password || ''}
                        onChange={(e) => handleChange('owner_password', e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="whatsapp"
                checked={formData.auto_assign_whatsapp_number}
                onCheckedChange={(checked) => handleChange('auto_assign_whatsapp_number', checked)}
              />
              <Label htmlFor="whatsapp">Asignar número de WhatsApp automáticamente</Label>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Crear Tenant'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
