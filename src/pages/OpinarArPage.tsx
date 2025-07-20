import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart2, Users, MapPin } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const genderData = [
  { name: "Masculino", value: 400 },
  { name: "Femenino", value: 300 },
  { name: "Otro", value: 100 },
];
const ageData = [
  { name: "18-25", value: 250 },
  { name: "26-40", value: 450 },
  { name: "41-60", value: 200 },
  { name: "60+", value: 100 },
];
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

const OpinarArPage: React.FC = () => {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center">
          <img
            src="/images/opinar-icon.svg"
            alt="Opinar.ar Logo"
            className="w-24 h-24 mx-auto mb-6"
          />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-700 to-cyan-400 text-transparent bg-clip-text">
            opinar.ar
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground">
            Una consultora inteligente basada en encuestas digitales.
          </p>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Visualice la Opinión Pública como Nunca Antes
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Nuestros dashboards interactivos transforman datos crudos en insights accionables. Explore la información demográfica, geográfica y de sentimiento en tiempo real.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-2">
          {/* Gender Distribution */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-4 flex items-center"><Users className="mr-2" /> Distribución por Género</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Age Distribution */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-primary mb-4 flex items-center"><BarChart2 className="mr-2" /> Distribución por Edad</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ageData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Transforme la opinión en acción
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Descubra el poder de los datos en tiempo real y tome decisiones más inteligentes para su municipio o empresa.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <a href="https://opinar.ar/demo" target="_blank" rel="noopener noreferrer">
                Probar Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button asChild size="lg" className="bg-sky-600 hover:bg-sky-700">
              <a href="https://opinar.ar" target="_blank" rel="noopener noreferrer">
                Visitar Opinar.ar
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-24 border-t border-border pt-8 text-center">
          <p className="text-muted-foreground">Síguenos en nuestras redes sociales</p>
          <div className="flex justify-center gap-6 mt-4">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.71v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.024.06 1.378.06 3.808s-.012 2.784-.06 3.808c-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.024.048-1.378.06-3.808.06s-2.784-.013-3.808-.06c-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.048-1.024-.06-1.378-.06-3.808s.012-2.784.06-3.808c.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 016.08 2.525c.636-.247 1.363-.416 2.427-.465C9.53 2.013 9.884 2 12.315 2zm-1.04 2.113c-2.363 0-2.67.01-3.61.056a2.766 2.766 0 00-1.573.447 2.766 2.766 0 00-.998.998c-.288.54-.422 1.144-.447 1.573-.046.94-.056 1.247-.056 3.61s.01 2.67.056 3.61c.025.429.16.832.447 1.573.272.522.63.88 1 .998.54.288 1.144.422 1.573.447.94.046 1.247.056 3.61.056s2.67-.01 3.61-.056c.429-.025.832-.16 1.573-.447a2.766 2.766 0 00.998-.998c.288-.54.422-1.144.447-1.573.046-.94.056-1.247.056-3.61s-.01-2.67-.056-3.61c-.025-.429-.16-.832-.447-1.573a2.766 2.766 0 00-.998-.998c-.54-.288-1.144-.422-1.573-.447-.94-.046-1.247-.056-3.61-.056zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5zM12 14a2 2 0 110-4 2 2 0 010 4zm6.36-8.883a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" clipRule="evenodd" /></svg>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OpinarArPage;
