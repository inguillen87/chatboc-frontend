import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Building2, ShoppingBag, Stethoscope, Store } from 'lucide-react';
import { DEMO_RUBROS } from '@/data/demo_rubros';

const categoryIcons: Record<string, React.ReactNode> = {
  municipios: <Building2 className="w-5 h-5" />,
  comercios: <ShoppingBag className="w-5 h-5" />,
  servicios: <Stethoscope className="w-5 h-5" />,
};

const DemoShowcaseSection = () => {
  const handleDemoClick = (slug: string) => {
    // Navigate to tenant-specific demo
    window.location.href = `/${slug}`;
  };

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

        <div className="space-y-12">
          {Object.entries(DEMO_RUBROS).map(([key, category]) => (
            <div key={key} className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {categoryIcons[key] || <Store className="w-5 h-5" />}
                </div>
                <h3 className="text-2xl font-semibold">{category.label}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.items.map((item) => (
                  <Card key={item.id} className="group hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer" onClick={() => handleDemoClick(item.id)}>
                    <CardHeader>
                      <CardTitle className="group-hover:text-primary transition-colors">{item.name}</CardTitle>
                      <CardDescription>{item.desc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground group-hover:bg-primary/5 transition-colors">
                        <p>Click para probar el asistente virtual de {item.name}.</p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground">
                        Ver Demo <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DemoShowcaseSection;
