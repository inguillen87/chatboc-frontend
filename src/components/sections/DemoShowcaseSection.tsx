import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Factory,
  GraduationCap,
  Heart,
  Loader2,
  ShoppingBag,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRubrosHierarchy } from "@/api/rubros";
import type { Rubro } from "@/types/rubro";
import { useNavigate } from "react-router-dom";

const categoryIcons: Record<string, React.ReactNode> = {
  municipios_root: <Building2 className="h-5 w-5" />,
  comerciales_root: <Store className="h-5 w-5" />,
  educacion_root: <GraduationCap className="h-5 w-5" />,
  "Soluciones para Sector Público": <Building2 className="h-5 w-5" />,
  "Soluciones para Empresas": <Store className="h-5 w-5" />,
  "Colegios e instituciones educativas": <GraduationCap className="h-5 w-5" />,
  "Alimentación y Bebidas": <ShoppingBag className="h-4 w-4" />,
  "Salud y Bienestar": <Heart className="h-4 w-4" />,
  "Servicios Profesionales": <Briefcase className="h-4 w-4" />,
  "Producción e Industria": <Factory className="h-4 w-4" />,
  "Retail y Comercios": <Store className="h-4 w-4" />,
};

const getIconForCategory = (cat: Rubro) => {
  if (cat.clave && categoryIcons[cat.clave]) return categoryIcons[cat.clave];
  const found = Object.keys(categoryIcons).find((key) => cat.nombre.includes(key));
  return found ? categoryIcons[found] : <Store className="h-4 w-4" />;
};

const DemoCard = ({ item }: { item: Rubro }) => {
  const navigate = useNavigate();
  if (!item.demo) return null;

  return (
    <Card
      className="group chatboc-hover-lift flex h-full cursor-pointer flex-col rounded-[8px] border-border/70 bg-card/90 shadow-sm"
      onClick={() => navigate(`/demo/${item.demo?.slug}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug transition-colors group-hover:text-primary">
            {item.demo.nombre || item.nombre}
          </CardTitle>
          <Badge variant="secondary" className="h-5 rounded-[8px] px-2 text-[10px]">
            Demo
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 text-sm">
          {item.demo.descripcion || "Experiencia interactiva disponible."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between rounded-[8px] text-xs font-semibold hover:bg-primary hover:text-primary-foreground"
        >
          Probar
          <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const SubCategorySection = ({ category }: { category: Rubro }) => {
  if (!category.subrubros || category.subrubros.length === 0) return null;

  const demoChildren = category.subrubros.filter((child) => child.demo);
  if (demoChildren.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 text-primary">
        {getIconForCategory(category)}
        <h4 className="text-base font-semibold text-foreground">{category.nombre}</h4>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {demoChildren.map((child) => (
          <DemoCard key={child.id} item={child} />
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
        const data = await getRubrosHierarchy();
        setTree(data);
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
      <section id="demos" className="flex min-h-[380px] items-center justify-center bg-background py-20">
        <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Cargando demos
        </div>
      </section>
    );
  }

  const rootCategories = tree;
  const defaultValue = rootCategories.length > 0 ? String(rootCategories[0].id) : undefined;

  return (
    <section id="demos" className="bg-background py-16 text-foreground md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="chatboc-section-kicker mb-4">Demos</div>
          <h2 className="chatboc-section-heading">Explorá experiencias conectadas al backend</h2>
          <p className="chatboc-section-copy mt-4">
            El selector usa la jerarquía de rubros disponible. Cuando backend agrega un sector o demo, esta grilla puede mostrarlo
            sin personalizaciones por componente.
          </p>
        </div>

        {rootCategories.length > 0 ? (
          <Tabs defaultValue={defaultValue} className="mx-auto w-full max-w-6xl">
            <div className="mb-8 overflow-x-auto pb-2">
              <TabsList className="mx-auto flex h-auto w-fit min-w-max flex-wrap justify-center gap-1 rounded-[8px] border border-border/70 bg-card/80 p-1 shadow-sm backdrop-blur">
                {rootCategories.map((root) => (
                  <TabsTrigger
                    key={root.id}
                    value={String(root.id)}
                    className="rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="flex items-center gap-2">
                      {getIconForCategory(root)}
                      {root.nombre}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {rootCategories.map((root) => (
              <TabsContent key={root.id} value={String(root.id)} className="focus-visible:ring-0">
                <div className="chatboc-landing-panel space-y-8 p-5 md:p-6">
                  {root.subrubros && root.subrubros.length > 0 ? (
                    root.subrubros.map((level1) => <SubCategorySection key={level1.id} category={level1} />)
                  ) : (
                    <div className="rounded-[8px] border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
                      No hay demos disponibles en esta categoría.
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="mx-auto max-w-2xl rounded-[8px] border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
            No hay demos disponibles por el momento.
          </div>
        )}
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
