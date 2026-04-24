import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, MessageSquare, FileText, Users, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const DashboardPreview = ({ type, tenantName }: { type: 'municipio' | 'pyme', tenantName: string }) => {
    return (
        <div className="bg-background border rounded-lg shadow-xl overflow-hidden text-left relative z-10 w-full transform transition-transform hover:scale-[1.01] duration-500">
            {/* Fake Browser Header */}
            <div className="bg-muted border-b p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                    </div>
                    <div className="ml-4 text-xs text-muted-foreground font-mono bg-background/50 px-3 py-1 rounded-md border flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        admin.chatboc.ar/{type === 'municipio' ? 'gobierno' : 'dashboard'}
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{tenantName}</span>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">
                        A
                    </div>
                </div>
            </div>

            <div className="p-6 bg-card/50">
                <div className="grid gap-6 md:grid-cols-3 mb-6">
                    {/* Stat Cards - Dynamic based on Type */}
                    <div className="bg-background p-4 rounded-lg border shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm text-muted-foreground">
                                {type === 'municipio' ? 'Reclamos Activos' : 'Ventas del Día'}
                            </span>
                            {type === 'municipio' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <TrendingUp className="w-4 h-4 text-green-500" />}
                        </div>
                        <div className="text-2xl font-bold">{type === 'municipio' ? '42' : '$ 124.500'}</div>
                        <div className="text-xs text-muted-foreground flex items-center mt-1">
                            <ArrowRight className="w-3 h-3 rotate-[-45deg] mr-1 text-green-600" />
                            {type === 'municipio' ? '-5% vs semana anterior' : '+15% objetivo diario'}
                        </div>
                    </div>

                    <div className="bg-background p-4 rounded-lg border shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm text-muted-foreground">
                                {type === 'municipio' ? 'Vecinos Atendidos' : 'Pedidos Pendientes'}
                            </span>
                            <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-2xl font-bold">{type === 'municipio' ? '856' : '12'}</div>
                        <div className="text-xs text-muted-foreground mt-1">En las últimas 24hs</div>
                    </div>

                    <div className="bg-background p-4 rounded-lg border shadow-sm hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm text-muted-foreground">
                                {type === 'municipio' ? 'Satisfacción Ciudadana' : 'Tasa de Conversión'}
                            </span>
                            <BarChart2 className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold">{type === 'municipio' ? '4.8/5' : '3.2%'}</div>
                        <div className="text-xs text-green-600 font-medium mt-1">Excelente</div>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Main Chart Area */}
                    <div className="md:col-span-2 bg-background p-5 rounded-lg border shadow-sm min-h-[200px] flex flex-col relative overflow-hidden group">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-semibold">
                                {type === 'municipio' ? 'Mapa de Calor (Reclamos)' : 'Rendimiento de Ventas'}
                            </h4>
                            <Badge variant="outline" className="text-[10px]">Tiempo Real</Badge>
                        </div>

                        {type === 'municipio' ? (
                             // Fake Heatmap for Municipio
                            <div className="flex-1 bg-muted/30 rounded relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/Map_of_Junin_Partidos.png')] bg-cover bg-center grayscale"></div>
                                {/* Heat spots */}
                                <div className="absolute top-1/3 left-1/4 w-16 h-16 bg-red-500/40 blur-xl rounded-full animate-pulse"></div>
                                <div className="absolute bottom-1/3 right-1/3 w-24 h-24 bg-orange-500/30 blur-xl rounded-full"></div>
                                <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-green-500/20 blur-lg rounded-full"></div>
                            </div>
                        ) : (
                            // Bar Chart for Pyme
                            <div className="flex-1 flex items-end gap-3 px-2 pb-2 justify-between">
                                {[40, 60, 45, 90, 65, 85, 95].map((h, i) => (
                                    <div key={i} className="w-full bg-primary/80 hover:bg-primary transition-all duration-300 rounded-t-sm relative group/bar" style={{ height: `${h}%` }}>
                                         <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                             {h}%
                                         </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Feed / Activity List */}
                    <div className="bg-background p-0 rounded-lg border shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b bg-muted/20">
                            <h4 className="text-sm font-semibold">Actividad Reciente</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {[1, 2, 3].map((_, i) => (
                                <div key={i} className="flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        {i === 0 ? 'IA' : 'U'}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-xs font-medium leading-none">
                                            {type === 'municipio'
                                                ? (i === 0 ? 'Agente respondió consulta sobre tasas' : 'Nuevo reclamo de alumbrado')
                                                : (i === 0 ? 'Agente cerró venta #4092' : 'Consulta de stock: Vino Malbec')
                                            }
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">Hace {i * 5 + 2} minutos</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t bg-muted/10 text-center">
                            <Button variant="ghost" size="sm" className="w-full text-xs h-8">Ver todo</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
