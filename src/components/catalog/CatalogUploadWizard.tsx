import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { UploadCloud, FileText, Check, AlertTriangle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useTenant } from '@/context/TenantContext';

interface UploadResponse {
  status: 'preview_ready' | 'needs_mapping';
  preview_items: any[];
  detected_columns: string[];
  expected_fields: string[];
  upload_token: string;
  stats?: {
    confidence_score: number;
  };
}

interface CatalogUploadWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function CatalogUploadWizard({ onComplete, onCancel }: CatalogUploadWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<UploadResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const { currentSlug } = useTenant();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileUrl('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setFileUrl('');
    }
  };

  const handleAnalyze = async () => {
    if ((!file && !fileUrl) || !currentSlug) return;
    setLoading(true);

    try {
      let payload: FormData | { file_url: string };
      if (file) {
        payload = new FormData();
        payload.append('file', file);
      } else {
        payload = { file_url: fileUrl };
      }

      const response = await apiClient.adminUploadCatalog(currentSlug, payload);
      setPreviewData(response);

      // Initialize mapping with exact matches if possible
      if (response.status === 'needs_mapping') {
        const initialMapping: Record<string, string> = {};
        response.expected_fields.forEach((field: string) => {
          // Simple fuzzy match or exact match logic
          const match = response.detected_columns.find(
            col => col.toLowerCase().replace(/_/g, ' ') === field.toLowerCase().replace(/_/g, ' ')
          );
          if (match) {
            initialMapping[field] = match;
          }
        });
        setMapping(initialMapping);
      }

      setStep(2);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || error?.body?.message || "Could not process the catalog file. Please check the format.";
      toast({
        variant: "destructive",
        title: "Error analyzing file",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewData || !currentSlug) return;
    setLoading(true);

    try {
      const payload = {
        upload_token: previewData.upload_token,
        mapping_override: Object.keys(mapping).length > 0 ? mapping : undefined
      };

      const result = await apiClient.adminConfirmCatalog(currentSlug, payload);

      setStep(3);

      if (result.status === 'partial_success' || (result.warnings && result.warnings.length > 0)) {
          const warningMsg = result.message || "Some items were skipped.";
          toast({
            variant: "warning",
            title: "Import Completed with Warnings",
            description: warningMsg,
          });
      } else {
          toast({
            title: "Success",
            description: "Catalog is being processed in the background.",
          });
      }
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.message || error?.body?.message || "Something went wrong during final processing.";
      toast({
        variant: "destructive",
        title: "Error confirming import",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => document.getElementById('wizard-file-input')?.click()}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-background rounded-full shadow-sm border">
            <UploadCloud className={`h-8 w-8 ${file ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">
              {file ? file.name : "Drag & drop your file here"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Supports CSV, Excel, PDF. Max 10MB.
            </p>
          </div>
          <Input
            id="wizard-file-input"
            type="file"
            className="hidden"
            accept=".csv, .xlsx, .xls, .pdf"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or import from URL</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/catalog.csv"
          value={fileUrl}
          onChange={(e) => {
            setFileUrl(e.target.value);
            setFile(null);
          }}
          disabled={!!file}
        />
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!previewData) return null;
    const isReady = previewData.status === 'preview_ready';

    return (
      <div className="space-y-6">
        {isReady ? (
          <Alert className="bg-green-50 text-green-900 border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <AlertTitle>Ready to Import</AlertTitle>
            <AlertDescription>
              We successfully analyzed your file with a confidence score of {previewData.stats?.confidence_score ?? 'N/A'}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Mapping Needed</AlertTitle>
            <AlertDescription>
              We couldn't automatically map all columns. Please verify the fields below.
            </AlertDescription>
          </Alert>
        )}

        <div className="border rounded-md overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b">
                <h4 className="font-medium text-sm">Data Preview (First 5 rows)</h4>
            </div>
            <div className="overflow-x-auto max-w-[80vw] md:max-w-none">
                <Table>
                    <TableHeader>
                    <TableRow>
                        {previewData.detected_columns.slice(0, 6).map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                        ))}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {previewData.preview_items.map((item, i) => (
                        <TableRow key={i}>
                        {previewData.detected_columns.slice(0, 6).map((col) => (
                            <TableCell key={col} className="whitespace-nowrap">
                            {typeof item[col] === 'object' ? JSON.stringify(item[col]) : item[col]}
                            </TableCell>
                        ))}
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
        </div>

        {!isReady && (
          <div className="space-y-4 border p-4 rounded-md">
            <h4 className="font-medium">Map Columns</h4>
            <div className="grid gap-4">
              {previewData.expected_fields.map((field) => (
                <div key={field} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                  <Label className="capitalize text-muted-foreground">{field.replace(/_/g, ' ')}</Label>
                  <Select
                    value={mapping[field] || ''}
                    onValueChange={(val) => setMapping(prev => ({ ...prev, [field]: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {previewData.detected_columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="text-center py-8 space-y-4">
      <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
        <Check className="h-8 w-8" />
      </div>
      <h3 className="text-2xl font-semibold">Import Started!</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Your catalog is being processed in the background. You will be notified when it's ready.
      </p>
      <Button onClick={onComplete} className="mt-4">
        Done
      </Button>
    </div>
  );

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Import Catalog</CardTitle>
        <CardDescription>
            {step === 1 && "Upload your product list to update your catalog."}
            {step === 2 && "Review and map your data columns."}
            {step === 3 && "Processing complete."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </CardContent>
      {step !== 3 && (
        <CardFooter className="flex justify-between border-t pt-6">
          <Button variant="ghost" onClick={step === 1 ? onCancel : () => setStep(1)} disabled={loading}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            onClick={step === 1 ? handleAnalyze : handleConfirm}
            disabled={loading || (step === 1 && !file && !fileUrl)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === 1 ? "Analyze File" : "Confirm Import"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
