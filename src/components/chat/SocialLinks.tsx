import React from 'react';
import { Facebook, Instagram, Youtube, Globe, ExternalLink } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{className?: string}>> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  web: Globe,
};

interface Props {
  links: Record<string, string>;
}

const SocialLinks: React.FC<Props> = ({ links }) => {
  const entries = Object.entries(links || {}).filter(([_, url]) => !!url);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {entries.map(([key, url]) => {
        const lower = key.toLowerCase();
        const Icon = iconMap[lower] || ExternalLink;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-sm"
          >
            <Icon className="w-4 h-4" />
            <span className="capitalize">{key}</span>
          </a>
        );
      })}
    </div>
  );
};

export default SocialLinks;
