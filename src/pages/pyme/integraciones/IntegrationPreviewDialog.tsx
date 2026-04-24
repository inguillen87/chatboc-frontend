import React, { useEffect, useState } from 'react';
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

interface IntegrationPreviewDialogProps {
    provider: string | null;
    tenantSlug: string | null;
    onClose: () => void;
}

interface PreviewItem {
    external_id: string;
    title: string;
    original_price: number;
    mapped_price: number;
    status: 'new' | 'update' | 'error' | 'active';
    will_create_new: boolean;
}
interface MappingStatusItem {
    source_category?: string;
    source?: string;
    target_category?: string;
    target?: string;
    status?: 'mapped' | 'pending' | 'error' | string;
}

const IntegrationPreviewDialog: React.FC<IntegrationPreviewDialogProps> = ({ provider, tenantSlug, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [previewData, setPreviewData] = useState<{ summary: any; items: PreviewItem[]; mappingStatus: MappingStatusItem[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (provider && tenantSlug) {
            loadPreview();
        }
    }, [provider, tenantSlug]);

    const loadPreview = async () => {
        if (!provider || !tenantSlug) return;
        setLoading(true);
        setError(null);
        try {
            const data = await apiClient.adminPreviewIntegration(tenantSlug, provider);
            if (data.success === false) {
                setError("No se pudo conectar con la integración.");
            } else {
                setPreviewData({
                    summary: data.summary || { total_found: 0, new_items: 0, updates: 0 },
                    items: data.items || [],
                    mappingStatus: Array.isArray(data.mapping_status)
                      ? data.mapping_status
                      : Array.isArray(data.attribute_mappings)
                        ? data.attribute_mappings
                        : [],
                });
            }
        } catch (e) {
            console.error(e);
            setError("Error al cargar la previsualización. Verificá la conexión.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSync = async () => {
        if (!provider || !tenantSlug) return;
        try {
            await apiClient.adminSyncIntegration(tenantSlug, provider);
            toast.success("Sincronización iniciada en segundo plano.");
            onClose();
        } catch (e) {
            toast.error("Error al iniciar la sincronización.");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analizando catálogo externo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="bg-red-100 p-3 rounded-full"><AlertTriangle className="h-6 w-6 text-red-600"/></div>
                <h3 className="font-medium text-lg">Error de Conexión</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">{error}</p>
                <Button onClick={onClose} variant="outline">Cerrar</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <DialogHeader>
                <DialogTitle className="capitalize flex items-center gap-2">
                    Previsualización de {provider}
                    {previewData?.summary && (
                        <Badge variant="secondary" className="ml-2 font-normal">
                            {previewData.summary.total_found} productos encontrados
                        </Badge>
                    )}
                </DialogTitle>
                <DialogDescription>
                    Resumen de cambios que se aplicarán al sincronizar.
                </DialogDescription>
            </DialogHeader>

            {previewData?.summary && (
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="border rounded-lg p-3 bg-green-50 border-green-100">
                        <div className="text-2xl font-bold text-green-700">{previewData.summary.new_items}</div>
                        <div className="text-xs text-green-800 font-medium">Nuevos</div>
                    </div>
                    <div className="border rounded-lg p-3 bg-blue-50 border-blue-100">
                        <div className="text-2xl font-bold text-blue-700">{previewData.summary.updates}</div>
                        <div className="text-xs text-blue-800 font-medium">Actualizaciones</div>
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50 border-gray-100">
                        <div className="text-2xl font-bold text-gray-700">
                            {previewData.summary.total_found - previewData.summary.new_items - previewData.summary.updates}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Sin Cambios</div>
                    </div>
                </div>
            )}

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="w-[100px]">Estado</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {previewData?.items.map((item, i) => (
                            <TableRow key={i}>
                                <TableCell>
                                    <div className="font-medium">{item.title}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{item.external_id}</div>
                                </TableCell>
                                <TableCell>
                                    {item.status === 'new' || item.will_create_new ? (
                                        <Badge className="bg-green-600">Nuevo</Badge>
                                    ) : item.status === 'update' ? (
                                        <Badge variant="secondary" className="text-blue-700 bg-blue-100">Update</Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">Sin cambios</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    ${item.mapped_price?.toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {previewData?.mappingStatus?.length ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Estado de mapeo de atributos/categorías</p>
                <div className="space-y-1.5">
                  {previewData.mappingStatus.slice(0, 8).map((mapping, idx) => {
                    const sourceLabel = mapping.source_category || mapping.source || `Origen ${idx + 1}`;
                    const targetLabel = mapping.target_category || mapping.target || "Sin mapear";
                    const status = (mapping.status || "").toLowerCase();
                    return (
                      <div key={`${sourceLabel}_${targetLabel}_${idx}`} className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                        <span className="font-medium">{sourceLabel}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="flex items-center gap-2">
                          {targetLabel}
                          <Badge variant={status === "mapped" ? "default" : status === "error" ? "destructive" : "secondary"}>
                            {status === "mapped" ? "Mapeado" : status === "error" ? "Error" : "Pendiente"}
                          </Badge>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleConfirmSync}>
                    Confirmar Sincronización <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default IntegrationPreviewDialog;
