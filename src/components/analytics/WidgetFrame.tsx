import { forwardRef, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Image as ImageIcon, MoreHorizontal } from 'lucide-react';
import { exportElementToPng, exportToCsv } from '@/utils/exportUtils';

export interface WidgetFrameProps {
  title: string;
  description?: string;
  csvData?: Record<string, unknown>[];
  exportFilename?: string;
  onExportCsv?: () => Record<string, unknown>[] | undefined;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const WidgetFrame = forwardRef<HTMLDivElement, WidgetFrameProps>(
  (
    { title, description, csvData, exportFilename = 'analytics-export', onExportCsv, actions, className, children },
    ref,
  ) => {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const composedRef = (node: HTMLDivElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const handleCsv = () => {
      const data = typeof onExportCsv === 'function' ? onExportCsv() : csvData;
      if (!data || data.length === 0) return;
      exportToCsv(`${exportFilename}.csv`, data);
    };

    const handlePng = async () => {
      await exportElementToPng(innerRef, `${exportFilename}.png`);
    };

    return (
      <Card ref={composedRef} className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={handleCsv} className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handlePng} className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> PNG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );
  },
);

WidgetFrame.displayName = 'WidgetFrame';
