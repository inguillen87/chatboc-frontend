import React, { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { findDemoCatalogAsset } from "@/data/demoCatalogAssets";
import { downloadDemoCatalogPdf } from "@/utils/demoCatalogPdf";

const DemoCatalogDownloadPage = () => {
  const { catalogFile } = useParams();
  const [isDownloading, setIsDownloading] = useState(false);
  const asset = useMemo(() => findDemoCatalogAsset(catalogFile), [catalogFile]);

  const handleDownload = async () => {
    if (!asset) return;
    setIsDownloading(true);
    try {
      await downloadDemoCatalogPdf(asset);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="chatboc-hero-grid flex min-h-screen items-center px-4 py-16">
        <div className="mx-auto w-full max-w-4xl">
          <Link to="/demo" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Volver al demo
          </Link>

          <div className="chatboc-landing-panel overflow-hidden rounded-2xl">
            <div className="grid gap-0 md:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-primary p-8 text-primary-foreground md:p-10">
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <FileText className="h-7 w-7" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Catalogo demo</p>
                <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                  {asset?.title || "Catalogo no encontrado"}
                </h1>
                {asset?.subtitle ? <p className="mt-4 text-sm leading-6 text-white/80">{asset.subtitle}</p> : null}
              </div>

              <div className="p-8 md:p-10">
                {asset ? (
                  <>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {(asset.highlights || []).slice(0, 4).map((highlight) => (
                        <span key={highlight} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                          {highlight}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{asset.description}</p>
                    <div className="mt-8 rounded-xl border border-border/70 bg-muted/30 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <ShieldCheck className="h-4 w-4 text-success" />
                        Descarga lista
                      </div>
                      <p className="text-xs leading-6 text-muted-foreground">
                        Chatboc prepara este material al instante para que puedas descargarlo aunque el archivo no venga incluido en la pagina.
                      </p>
                    </div>
                    <Button className="mt-8 h-11 rounded-xl px-5" onClick={handleDownload} disabled={isDownloading}>
                      <Download className="mr-2 h-4 w-4" />
                      {isDownloading ? "Preparando PDF" : "Descargar PDF"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm leading-7 text-muted-foreground">
                      No encontramos ese catalogo demo. Podes volver al selector para elegir un pilar y generar un material disponible.
                    </p>
                    <Button asChild className="mt-8 h-11 rounded-xl px-5">
                      <Link to="/demo">Elegir demo</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DemoCatalogDownloadPage;
