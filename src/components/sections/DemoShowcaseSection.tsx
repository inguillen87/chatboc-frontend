import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { ArrowRight, Building2, ShoppingBag, Stethoscope, Store, Loader2, ChevronRight } from 'lucide-react';
import { fetchRubros, buildRubroTree, Rubro } from '@/api/rubros';

// Fallback Mock Data mirroring the backend structure (padre_id)
const FALLBACK_RUBROS_FLAT: Rubro[] = [
  // Categorías Principales
  { id: 1, nombre: "Gobiernos y Municipios", clave: "municipios", padre_id: null },
  { id: 2, nombre: "Comercios y Retail", clave: "comercios", padre_id: null },
  { id: 3, nombre: "Servicios Profesionales", clave: "servicios", padre_id: null },

  // Subcategorías / Tenants
  { id: 101, nombre: "Municipio Inteligente", padre_id: 1, demo: { id: 101, slug: "municipio", nombre: "Municipio Inteligente", descripcion: "Trámites, reclamos y turismo." } },
  { id: 201, nombre: "Almacén de Barrio", padre_id: 2, demo: { id: 201, slug: "almacen", nombre: "Almacén Demo", descripcion: "Pedidos por foto y stock." } },
  { id: 202, nombre: "Ferretería Técnica", padre_id: 2, demo: { id: 202, slug: "ferreteria", nombre: "Ferretería Demo", descripcion: "Asesoramiento y catálogo." } },
  { id: 203, nombre: "Tienda de Ropa", padre_id: 2, demo: { id: 203, slug: "local_comercial_general", nombre: "Tienda de Ropa Demo", descripcion: "Moda, talles y reservas." } },
  { id: 204, nombre: "Bodega Boutique", padre_id: 2, demo: { id: 204, slug: "bodega", nombre: "Bodega Demo", descripcion: "Vinos, catas y envíos." } },
  { id: 301, nombre: "Clínica Médica", padre_id: 3, demo: { id: 301, slug: "medico_general", nombre: "Clínica Demo", descripcion: "Turnos y consultas." } },
];

const categoryIcons: Record<string, React.ReactNode> = {
  municipios: <Building2 className="w-5 h-5" />,
  comercios: <ShoppingBag className="w-5 h-5" />,
  servicios: <Stethoscope className="w-5 h-5" />,
};

const DemoCard = ({ item }: { item: Rubro }) => {
  if (!item.demo) return null; // Should be a leaf node with demo info

  const handleDemoClick = () => {
    window.location.href = `/demo/${item.demo?.slug}`;
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer h-full flex flex-col" onClick={handleDemoClick}>
      <CardHeader>
        <CardTitle className="group-hover:text-primary transition-colors text-lg">{item.demo.nombre || item.nombre}</CardTitle>
        <CardDescription>{item.demo.descripcion || "Demo interactiva"}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground group-hover:bg-primary/5 transition-colors">
          <p>Click para probar el asistente virtual.</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground">
          Ver Demo <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const CategoryGroup = ({ category }: { category: Rubro }) => {
  const icon = category.clave ? categoryIcons[category.clave] : <Store className="w-5 h-5" />;
  const hasChildren = category.subrubros && category.subrubros.length > 0;

  if (!hasChildren) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border pb-2">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          {icon}
        </div>
        <h3 className="text-2xl font-semibold">{category.nombre}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {category.subrubros!.map((child) => (
          child.subrubros && child.subrubros.length > 0 ? (
             // Recursive case: If it has children, render them (flattened for display simplicity or nested if desired)
             // For this design, we'll flatten subcategories into cards if they don't have their own section
             // But the prompt implies "Categoría -> Subcategoría -> Tenant".
             // Let's iterate the children. If the child is a "Category container" (has subrubros), we might need a subtitle.
             // If the child IS the tenant (has .demo), render card.
             child.demo ? (
                <DemoCard key={child.id} item={child} />
             ) : (
                <div key={child.id} className="col-span-full space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-muted-foreground font-medium pl-1">
                        <ChevronRight className="w-4 h-4" />
                        <h4>{child.nombre}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {child.subrubros!.map(grandChild => (
                            grandChild.demo ? <DemoCard key={grandChild.id} item={grandChild} /> : null
                        ))}
                    </div>
                </div>
             )
          ) : (
             child.demo ? <DemoCard key={child.id} item={child} /> : null
          )
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
        // Try to fetch from API
        const data = await fetchRubros();
        // If API returns empty or fails structure check, use fallback
        if (!data || data.length === 0) {
            setTree(buildRubroTree(FALLBACK_RUBROS_FLAT));
        } else {
            setTree(buildRubroTree(data));
        }
      } catch (error) {
        // Fallback to mock data if API fails (e.g. backend not ready yet)
        console.warn("Using fallback demo data due to fetch error", error);
        setTree(buildRubroTree(FALLBACK_RUBROS_FLAT));
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  return (
    <section id="demos" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-1 border-primary/20 text-primary bg-primary/5">
            Experiencias Reales
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Explora nuestros Demos Interactivos
          </h2>
          <p className="text-muted-foreground text-lg">
            Probá cómo funciona Chatboc en diferentes industrias. Cada demo está diseñada para mostrar flujos reales: pedidos por foto, reclamos ciudadanos, turnos médicos y más.
          </p>
        </div>

        {loading ? (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="space-y-12">
            {tree.map((category) => (
                <CategoryGroup key={category.id} category={category} />
            ))}
            </div>
        )}
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
