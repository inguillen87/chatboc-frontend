import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ShoppingBag, Stethoscope, Store, Loader2, ChevronRight, Factory, Heart, Briefcase } from 'lucide-react';
import { fetchRubros, buildRubroTree, Rubro } from '@/api/rubros';

// Fallback Mock Data mirroring the backend structure (padre_id)
// Structure: Root -> Level 1 -> Level 2 (Tenant)
const FALLBACK_RUBROS_FLAT: Rubro[] = [
  // --- ROOTS ---
  { id: 1, nombre: "Municipios y Gobierno", clave: "municipios_root", padre_id: null },
  { id: 2, nombre: "Locales Comerciales", clave: "comerciales_root", padre_id: null },

  // --- LEVEL 1: Municipios ---
  { id: 11, nombre: "Municipios", padre_id: 1 },
  // --- LEVEL 2: Tenants (Municipios) ---
  { id: 101, nombre: "Municipio Inteligente", padre_id: 11, demo: { id: 101, slug: "municipio", nombre: "Municipio Inteligente", descripcion: "Trámites, reclamos y turismo." } },

  // --- LEVEL 1: Locales Comerciales ---

  // Alimentación y Bebidas
  { id: 21, nombre: "Alimentación y Bebidas", padre_id: 2 },
  { id: 201, nombre: "Almacén de Barrio", padre_id: 21, demo: { id: 201, slug: "almacen", nombre: "Almacén Demo", descripcion: "Pedidos por foto y stock." } },
  { id: 204, nombre: "Bodega Boutique", padre_id: 21, demo: { id: 204, slug: "bodega", nombre: "Bodega Demo", descripcion: "Vinos, catas y envíos." } },
  { id: 205, nombre: "Kiosco 24hs", padre_id: 21, demo: { id: 205, slug: "almacen", nombre: "Kiosco Demo", descripcion: "Snacks y bebidas." } }, // Reusing almacen slug for generic demo
  { id: 206, nombre: "Gastronomía", padre_id: 21, demo: { id: 206, slug: "bodega", nombre: "Restaurante Demo", descripcion: "Reservas y menú digital." } }, // Reusing bodega slug for generic demo

  // Retail y Comercios
  { id: 22, nombre: "Retail y Comercios", padre_id: 2 },
  { id: 202, nombre: "Ferretería Técnica", padre_id: 22, demo: { id: 202, slug: "ferreteria", nombre: "Ferretería Demo", descripcion: "Asesoramiento y catálogo." } },
  { id: 203, nombre: "Tienda de Ropa", padre_id: 22, demo: { id: 203, slug: "local_comercial_general", nombre: "Tienda de Ropa Demo", descripcion: "Moda, talles y reservas." } },

  // Servicios Profesionales (Moving to root or keeping as sub? Prompt implies hierarchy under separate heads)
  // Let's stick to the prompt structure.
  // Prompt: Servicios Profesionales under Locales Comerciales? Or separate?
  // Prompt says:
  // * Locales Comerciales
  //    * ...
  //    * Servicios Profesionales
  // So it is a Level 1 under Locales Comerciales in the prompt text.
  { id: 23, nombre: "Servicios Profesionales", padre_id: 2 },
  { id: 302, nombre: "Logística y Transporte", padre_id: 23, demo: { id: 302, slug: "ferreteria", nombre: "Logística Demo", descripcion: "Seguimiento y cotizaciones." } }, // Using generic slug
  { id: 303, nombre: "Seguros y Riesgos", padre_id: 23, demo: { id: 303, slug: "medico_general", nombre: "Seguros Demo", descripcion: "Pólizas y siniestros." } },
  { id: 304, nombre: "Fintech y Banca", padre_id: 23, demo: { id: 304, slug: "medico_general", nombre: "Fintech Demo", descripcion: "Atención al cliente 24/7." } },
  { id: 305, nombre: "Inmobiliaria", padre_id: 23, demo: { id: 305, slug: "medico_general", nombre: "Inmobiliaria Demo", descripcion: "Propiedades y citas." } },
  { id: 306, nombre: "Energía e Industria", padre_id: 23, demo: { id: 306, slug: "ferreteria", nombre: "Industria Demo", descripcion: "Soporte técnico y ventas." } },

  // Salud y Bienestar (Under Locales Comerciales per prompt? Or separate? Prompt list is indented under Locales Comerciales)
  { id: 24, nombre: "Salud y Bienestar", padre_id: 2 },
  { id: 301, nombre: "Salud y Medicina", padre_id: 24, demo: { id: 301, slug: "medico_general", nombre: "Clínica Demo", descripcion: "Turnos y consultas." } },
  { id: 307, nombre: "Farmacia", padre_id: 24, demo: { id: 307, slug: "almacen", nombre: "Farmacia Demo", descripcion: "Recetas y envíos." } },

  // Producción e Industria (Level 1)
  { id: 25, nombre: "Producción e Industria", padre_id: 2 },
];

const categoryIcons: Record<string, React.ReactNode> = {
  municipios_root: <Building2 className="w-5 h-5" />,
  comerciales_root: <Store className="w-5 h-5" />,
  // Mapping level 1 icons based on name containment
  "Alimentación y Bebidas": <ShoppingBag className="w-4 h-4" />,
  "Salud y Bienestar": <Heart className="w-4 h-4" />,
  "Servicios Profesionales": <Briefcase className="w-4 h-4" />,
  "Producción e Industria": <Factory className="w-4 h-4" />,
  "Retail y Comercios": <Store className="w-4 h-4" />
};

const getIconForCategory = (cat: Rubro) => {
    if (cat.clave && categoryIcons[cat.clave]) return categoryIcons[cat.clave];
    // Fallback based on name match
    const found = Object.keys(categoryIcons).find(k => cat.nombre.includes(k));
    if (found) return categoryIcons[found];
    return <Store className="w-4 h-4" />;
};

const DemoCard = ({ item }: { item: Rubro }) => {
  const navigate = useNavigate();
  if (!item.demo) return null;

  const handleDemoClick = () => {
    navigate(`/demo/${item.demo?.slug}`);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer h-full flex flex-col bg-card/60 backdrop-blur-sm" onClick={handleDemoClick}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
            <CardTitle className="group-hover:text-primary transition-colors text-base font-semibold">{item.demo.nombre || item.nombre}</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 opacity-70 group-hover:opacity-100 transition-opacity">Demo</Badge>
        </div>
        <CardDescription className="text-sm line-clamp-2">{item.demo.descripcion || "Demo interactiva disponible 24/7."}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-0">
         {/* Optional content space */}
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="ghost" size="sm" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground text-xs h-8">
          Probar Ahora <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const SubCategorySection = ({ category }: { category: Rubro }) => {
  // This renders Level 1 Category -> Level 2 Grid
  if (!category.subrubros || category.subrubros.length === 0) return null;

  return (
    <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-2 mb-4 text-primary/80 border-b border-border/50 pb-1">
            {getIconForCategory(category)}
            <h4 className="text-lg font-semibold">{category.nombre}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {category.subrubros.map(child => (
                child.demo ? (
                    <DemoCard key={child.id} item={child} />
                ) : null
            ))}
        </div>
    </div>
  );
};

const DemoShowcaseSection = () => {
  const [tree, setTree] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        const data = await fetchRubros();
        if (!data || data.length === 0) {
            setTree(buildRubroTree(FALLBACK_RUBROS_FLAT));
        } else {
            setTree(buildRubroTree(data));
        }
      } catch (error) {
        console.warn("Using fallback demo data due to fetch error", error);
        setTree(buildRubroTree(FALLBACK_RUBROS_FLAT));
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  if (loading) {
      return (
        <section id="demos" className="py-20 bg-muted/30 min-h-[400px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </section>
      );
  }

  // Ensure we have roots
  const rootCategories = tree;
  const defaultValue = rootCategories.length > 0 ? String(rootCategories[0].id) : undefined;

  return (
    <section id="demos" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1 border-primary/20 text-primary bg-primary/5">
            Experiencias Reales
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Explora nuestros Demos Interactivos
          </h2>
          <p className="text-muted-foreground text-lg">
            Seleccioná tu industria y probá cómo funciona Chatboc en tiempo real.
          </p>
        </div>

        {rootCategories.length > 0 && (
            <Tabs defaultValue={defaultValue} className="w-full max-w-6xl mx-auto">
                <div className="flex justify-center mb-8">
                    <TabsList className="h-auto p-1 bg-background/50 backdrop-blur-sm border shadow-sm rounded-full">
                        {rootCategories.map((root) => (
                            <TabsTrigger
                                key={root.id}
                                value={String(root.id)}
                                className="rounded-full px-6 py-2.5 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    {getIconForCategory(root)}
                                    {root.nombre}
                                </div>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {rootCategories.map((root) => (
                    <TabsContent key={root.id} value={String(root.id)} className="animate-in fade-in-50 zoom-in-95 duration-300">
                        <div className="space-y-8 bg-background/40 p-6 rounded-3xl border border-white/20 shadow-sm">
                            {root.subrubros && root.subrubros.length > 0 ? (
                                root.subrubros.map(level1 => (
                                    <SubCategorySection key={level1.id} category={level1} />
                                ))
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">No hay demos disponibles en esta categoría.</div>
                            )}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        )}
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
