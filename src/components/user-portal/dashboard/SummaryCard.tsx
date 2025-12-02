import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react'; // Ejemplo de icono

interface SummaryCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  ctaText?: string;
  onCtaClick?: () => void;
  className?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  icon,
  children,
  ctaText,
  onCtaClick,
  className,
}) => {
  return (
    <Card className={`shadow-lg flex flex-col ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-dark">{title}</CardTitle>
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        {children}
      </CardContent>
      {ctaText && onCtaClick && (
        <CardFooter className="pt-4">
          <Button variant="link" size="sm" onClick={onCtaClick} className="p-0 h-auto text-primary hover:text-primary/80">
            {ctaText}
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default SummaryCard;
