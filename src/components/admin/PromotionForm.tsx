import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const promotionFormSchema = z.object({
  title: z
    .string()
    .min(3, { message: 'El título debe tener al menos 3 caracteres.' })
    .max(100),
  description: z
    .string()
    .min(5, { message: 'La descripción debe tener al menos 5 caracteres.' }),
  link: z
    .string()
    .url({ message: 'Por favor, introduce una URL válida.' }),
  flyer: z
    .any()
    .optional()
    .refine(
      (files) => {
        if (!files || files.length === 0) return true;
        return files?.[0]?.size <= MAX_FILE_SIZE;
      },
      `El tamaño máximo de la imagen es 5MB.`
    )
    .refine(
      (files) => {
        if (!files || files.length === 0) return true;
        return ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type);
      },
      'Solo se aceptan formatos .jpg, .png, y .webp.'
    ),
});

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

interface PromotionFormProps {
  onSubmit: (values: PromotionFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const PromotionForm: React.FC<PromotionFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const form = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      title: '',
      description: '',
      link: '',
      flyer: undefined,
    },
  });

  function handleFormSubmit(values: PromotionFormValues) {
    onSubmit(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Promoción de verano" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe tu promoción..."
                  className="resize-y"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="link"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Enlace</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="flyer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Flyer (Opcional)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => field.onChange(e.target.files)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar Promoción
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default PromotionForm;

