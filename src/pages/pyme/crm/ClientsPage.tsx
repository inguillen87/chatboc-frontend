import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
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
import {useUser} from '@/hooks/useUser';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent,subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {ApiError,getErrorMessage} from '@/utils/api';
import {ViewState} from '@/components/app-shell/ViewState';

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
  const {user,hasVerifiedSession}=useUser();
  const sessionRevision=useSyncExternalStore(subscribeChatbocSessionRevision,captureChatbocSessionRevision,captureChatbocSessionRevision);
  const canRead=Boolean(currentSlug&&hasVerifiedSession===true&&(user?.id||user?.email));
  const authorityKey=JSON.stringify([currentSlug??null,user?.id??user?.email??null,hasVerifiedSession===true,sessionRevision]);
  const authorityEpoch=useRef({key:authorityKey,epoch:0});
  if(authorityEpoch.current.key!==authorityKey)authorityEpoch.current={key:authorityKey,epoch:authorityEpoch.current.epoch+1};
  const scopeKey=JSON.stringify([authorityKey,authorityEpoch.current.epoch]);
  const scope=useRef({key:scopeKey,generation:0,attempt:0,pending:false});
  if(scope.current.key!==scopeKey)scope.current={key:scopeKey,generation:scope.current.generation+1,attempt:0,pending:false};
  const mounted=useRef(true);
  const navigate = useNavigate();
  const [read,setRead]=useState<{scope:string;items:Contact[];loading:boolean;error:string|null;denied:boolean}|null>(null);
  const currentRead=read?.scope===scopeKey?read:null;
  const contacts=currentRead?.items??[];
  const loading=canRead&&(!currentRead||currentRead.loading);
  const [searchState,setSearchState]=useState<{scope:string;value:string}|null>(null);
  const searchTerm=searchState?.scope===scopeKey?searchState.value:'';
  const setSearchTerm=(value:string)=>setSearchState({scope:scopeKey,value});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;scope.current.generation++;scope.current.attempt++;scope.current.pending=false;};},[]);

  useEffect(() => {
    if (canRead) {
      loadContacts();
    }
  }, [scopeKey]);

  const loadContacts = async () => {
    if(!canRead||!currentSlug||scope.current.pending)return;
    const generation=scope.current.generation,attempt=++scope.current.attempt;
    const isCurrent=()=>mounted.current&&scope.current.key===scopeKey&&scope.current.generation===generation&&scope.current.attempt===attempt&&isChatbocSessionRevisionCurrent(sessionRevision);
    scope.current.pending=true;
    setRead(previous=>({scope:scopeKey,items:previous?.scope===scopeKey?previous.items:[],loading:true,error:null,denied:false}));
    try {
      const response = await apiClient.adminListContacts(currentSlug);
      if(!isCurrent())return;
      if(!Array.isArray(response?.contacts))throw new Error('La respuesta de contactos no pudo validarse.');
      setRead({scope:scopeKey,items:response.contacts,loading:false,error:null,denied:false});
    } catch (error) {
      if(!isCurrent())return;
      const denied=error instanceof ApiError&&(error.status===401||error.status===403);
      setRead(previous=>({scope:scopeKey,items:!denied&&previous?.scope===scopeKey?previous.items:[],loading:false,error:getErrorMessage(error,'No pudimos cargar los contactos.'),denied}));
    } finally {
      if(isCurrent())scope.current.pending=false;
    }
  };

  const filteredContacts = contacts.filter(c =>
    (c.name||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone||'').includes(searchTerm)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes / CRM</h1>
          <p className="text-muted-foreground">Gestión de contactos y memoria.</p>
        </div>
        <Button onClick={loadContacts} disabled={loading||!canRead} variant="outline" size="sm">
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
            {currentRead?.error?<div role="alert" className="mb-4"><ViewState status={currentRead.denied?'denied':contacts.length?'stale':'error'} description={currentRead.error} action={<Button onClick={loadContacts} disabled={loading}>Reintentar</Button>}/></div>:null}
            {!canRead ? <ViewState status="denied" title="Necesitás una sesión verificada" description="Iniciá sesión para consultar los contactos de esta organización."/> : loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (!currentRead?.error||contacts.length>0) ? (
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
                                                onClick={() => {if(canRead&&mounted.current&&scope.current.key===scopeKey&&isChatbocSessionRevisionCurrent(sessionRevision))navigate(`/${currentSlug}/crm/clientes/${encodeURIComponent(contact.id)}`);}}
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
            ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsPage;
