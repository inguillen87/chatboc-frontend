import React, { useMemo, useState } from "react";
import { ImageOff, Loader2, Star, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/api/client";
import {
  getProductGalleryUrls,
  getProductImageAlt,
  getProductImageStatus,
  getProductPrimaryImage,
} from "@/utils/marketImages";
import { getErrorMessage } from "@/utils/api";

interface ProductImageManagerProps {
  tenantSlug: string;
  product: Record<string, any>;
  onUpdated: (product: Record<string, any>) => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default function ProductImageManager({
  tenantSlug,
  product,
  onUpdated,
}: ProductImageManagerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(() => getProductPrimaryImage(product) ?? "");
  const [galleryText, setGalleryText] = useState(() => getProductGalleryUrls(product).join("\n"));
  const [imageAlt, setImageAlt] = useState(() => getProductImageAlt(product, ""));
  const [file, setFile] = useState<File | null>(null);
  const [makePrimary, setMakePrimary] = useState(true);
  const productName = product.name || product.nombre || "Producto";
  const imageStatus = getProductImageStatus(product);
  const previewUrls = useMemo(
    () =>
      Array.from(
        new Set(
          [imageUrl, ...galleryText.split(/\n+/g)]
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ),
    [galleryText, imageUrl],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!nextFile.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      event.target.value = "";
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      toast.error("La imagen supera el tamano maximo permitido.");
      event.target.value = "";
      return;
    }
    setFile(nextFile);
  };

  const handleSave = async () => {
    if (!product.id) return;
    setSaving(true);
    try {
      const formData = new FormData();
      if (file) formData.append("image", file);
      if (imageUrl.trim()) {
        formData.append("image_url", imageUrl.trim());
        formData.append("primary_image_url", imageUrl.trim());
      }
      const galleryUrls = galleryText
        .split(/\n+/g)
        .map((item) => item.trim())
        .filter(Boolean);
      if (galleryUrls.length) formData.append("gallery_urls", JSON.stringify(galleryUrls));
      if (imageAlt.trim()) formData.append("image_alt", imageAlt.trim());
      formData.append("replace", "true");
      formData.append("make_primary", makePrimary ? "true" : "false");

      const response = await apiClient.adminUpdateProductImages(
        tenantSlug,
        product.id,
        formData,
      );
      onUpdated(response?.product ?? response ?? product);
      toast.success("Imagen del producto actualizada.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la imagen."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2">
          <UploadCloud className="h-3.5 w-3.5" />
          Imagen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Imagenes del producto</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt={imageAlt || productName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageOff className="h-8 w-8" />
                </div>
              )}
            </div>
            <span
              className={[
                "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                imageStatus === "missing"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {imageStatus === "missing" ? "Sin imagen" : "Imagen lista"}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Imagen principal</label>
              <Input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Subir imagen</label>
              <Input type="file" accept="image/*" onChange={handleFileChange} />
              {file ? <p className="mt-1 text-xs text-muted-foreground">{file.name}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Galeria</label>
              <textarea
                value={galleryText}
                onChange={(event) => setGalleryText(event.target.value)}
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Una URL por linea"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Texto alternativo</label>
              <Input
                value={imageAlt}
                onChange={(event) => setImageAlt(event.target.value)}
                placeholder={String(productName)}
              />
            </div>

            {previewUrls.length ? (
              <div className="flex gap-2 overflow-x-auto rounded-lg border bg-muted/30 p-2">
                {previewUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-background">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {index === 0 ? <Star className="absolute right-1 top-1 h-3.5 w-3.5 fill-amber-400 text-amber-500" /> : null}
                  </div>
                ))}
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={makePrimary}
                onChange={(event) => setMakePrimary(event.target.checked)}
              />
              Marcar como principal
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Guardar imagenes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
