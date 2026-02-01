import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, User, Eye } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'customer' | 'vecino' | 'lead';
  total_orders: number;
  ltv: number;
  last_interaction: string;
}

const ClientsPage = () => {
  const { currentSlug } = useTenant();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentSlug) {
      loadContacts();
    }
  }, [currentSlug]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const response = await apiClient.adminListContacts(currentSlug);
      // Assuming response structure { contacts: [...] }
      setContacts(response.contacts || []);
    } catch (error) {
      console.error("Failed to load contacts", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes / CRM</h1>
          <p className="text-muted-foreground">Gestión de contactos y memoria.</p>
        </div>
        <Button onClick={loadContacts} variant="outline" size="sm">
            Recargar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre o teléfono..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Pedidos</TableHead>
                                <TableHead className="text-right">LTV</TableHead>
                                <TableHead>Última Interacción</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredContacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No se encontraron contactos.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredContacts.map((contact) => (
                                    <TableRow key={contact.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                {contact.name || 'Desconocido'}
                                            </div>
                                        </TableCell>
                                        <TableCell>{contact.phone}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="capitalize">
                                                {contact.type || 'lead'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{contact.total_orders}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(contact.ltv)}</TableCell>
                                        <TableCell>
                                            {contact.last_interaction ? format(new Date(contact.last_interaction), "d MMM, HH:mm", { locale: es }) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/${currentSlug}/crm/clientes/${contact.id}`)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" /> Ver
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsPage;
