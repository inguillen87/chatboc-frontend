import React from "react";
import { Button } from "@/components/ui/button";

interface CatalogShareCardProps {
  title?: string | null;
  text?: string | null;
  bannerUrl?: string | null;
  viewUrl?: string | null;
  downloadUrl?: string | null;
  viewLabel?: string | null;
  downloadLabel?: string | null;
}

const CatalogShareCard: React.FC<CatalogShareCardProps> = ({
  title,
  text,
  bannerUrl,
  viewUrl,
  downloadUrl,
  viewLabel,
  downloadLabel,
}) => {
  const hasView = Boolean(viewUrl && viewLabel);
  const hasDownload = Boolean(downloadUrl && downloadLabel);

  if (!title && !text && !bannerUrl && !hasView && !hasDownload) {
    return null;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {bannerUrl && (
        <div className="h-36 w-full overflow-hidden bg-muted">
          <img src={bannerUrl} alt={title ?? ""} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="space-y-3 p-4">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {text && <p className="text-sm text-muted-foreground whitespace-pre-line">{text}</p>}
        {(hasView || hasDownload) && (
          <div className="flex flex-wrap gap-2">
            {hasView && (
              <Button asChild variant="outline" size="sm">
                <a href={viewUrl ?? undefined} target="_blank" rel="noreferrer">
                  {viewLabel}
                </a>
              </Button>
            )}
            {hasDownload && (
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl ?? undefined} target="_blank" rel="noreferrer">
                  {downloadLabel}
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogShareCard;
