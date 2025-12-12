import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ShoppingBag, Stethoscope, Store, Loader2, ChevronRight, Factory, Heart, Briefcase } from 'lucide-react';
import { getRubrosHierarchy } from '@/api/rubros';
import { Rubro } from '@/types/rubro';

const categoryIcons: Record<string, React.ReactNode> = {
  municipios_root: <Building2 className="w-5 h-5" />,
  comerciales_root: <Store className="w-5 h-5" />,
  "Alimentación y Bebidas": <ShoppingBag className="w-4 h-4" />,
  "Salud y Bienestar": <Heart className="w-4 h-4" />,
  "Servicios Profesionales": <Briefcase className="w-4 h-4" />,
  "Producción e Industria": <Factory className="w-4 h-4" />,
  "Retail y Comercios": <Store className="w-4 h-4" />
};

const getIconForCategory = (cat: Rubro) => {
    if (cat.clave && categoryIcons[cat.clave]) return categoryIcons[cat.clave];
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

  const hasDemoNodes = (nodes: Rubro[]): boolean =>
    nodes.some((node) => node.demo || (node.subrubros && hasDemoNodes(node.subrubros)));

  useEffect(() => {
    const initData = async () => {
      try {
        const data = await getRubrosHierarchy({ allowDemoAugmentation: true });

        if (Array.isArray(data) && data.length > 0 && hasDemoNodes(data)) {
          setTree(data);
        } else {
          // Hard fallback to the static demo hierarchy so demos remain visible
          // even if the backend omits demo metadata.
          const { DEMO_HIERARCHY } = await import('@/data/demoHierarchy');
          setTree(DEMO_HIERARCHY);
        }
      } catch (error) {
        console.error("Error loading demo hierarchy", error);
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
                <div className="flex justify-center mb-8 overflow-x-auto pb-4 md:pb-0">
                    <TabsList className="h-auto p-1 bg-background/50 backdrop-blur-sm border shadow-sm rounded-full flex-wrap justify-center">
                        {rootCategories.map((root) => (
                            <TabsTrigger
                                key={root.id}
                                value={String(root.id)}
                                className="rounded-full px-6 py-2.5 text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all whitespace-nowrap"
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
                    <TabsContent key={root.id} value={String(root.id)} className="animate-in fade-in-50 zoom-in-95 duration-300 focus-visible:ring-0">
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
