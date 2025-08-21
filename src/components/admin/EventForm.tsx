import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// 1. Define the validation schema with Zod
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const eventFormSchema = z.object({
  title: z.string().min(5, { message: 'El título debe tener al menos 5 caracteres.' }).max(100),
  description: z.string().optional(),
  startDate: z.date({ required_error: 'La fecha de inicio es obligatoria.' }),
  endDate: z.date().optional(),
  location: z.object({
      address: z.string().optional(),
  }).optional(),
  category: z.string().optional(),
  imageUrl: z.string().url({ message: 'Por favor, introduce una URL válida.' }).optional().or(z.literal('')),
  flyer: z.any()
    .optional()
    .refine((files) => {
        if (!files || files.length === 0) return true; // Optional field
        return files?.[0]?.size <= MAX_FILE_SIZE;
    }, `El tamaño máximo de la imagen es 5MB.`)
    .refine((files) => {
        if (!files || files.length === 0) return true; // Optional field
        return ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type);
    }, "Solo se aceptan formatos .jpg, .png, y .webp."),
}).refine(data => !data.imageUrl || !data.flyer || data.flyer.length === 0, {
    message: "Puedes proveer una URL o subir un archivo, pero no ambos.",
    path: ["flyer"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialData?: Partial<EventFormValues>;
}

export const EventForm: React.FC<EventFormProps> = ({ onSubmit, onCancel, isSubmitting, initialData }) => {
  // 2. Define the form
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      startDate: undefined,
      endDate: undefined,
      location: { address: '' },
      category: '',
      imageUrl: '',
      ...initialData,
    },
  });

  // 3. Define the submit handler
  function handleFormSubmit(values: EventFormValues) {
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
              <FormLabel>Título del Evento / Noticia</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Festival de la Vendimia" {...field} />
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
                  placeholder="Describe los detalles del evento o la noticia..."
                  className="resize-y"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Inicio</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      locale={es}
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Fin (Opcional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < (form.getValues("startDate") || new Date("1900-01-01"))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location.address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación (Dirección)</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Parque San Martín, Mendoza" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Cultura, Deportes, Anuncio" {...field} />
              </FormControl>
              <FormDescription>
                Asigna una categoría para facilitar la búsqueda y el filtrado.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL de la Imagen (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="https://ejemplo.com/imagen.jpg" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="text-center text-sm text-muted-foreground my-2">ó</div>

        <FormField
          control={form.control}
          name="flyer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subir Flyer del Evento (Opcional)</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => field.onChange(e.target.files)}
                  className="text-muted-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                />
              </FormControl>
              <FormDescription>
                Sube una imagen (flyer) para el evento. Máximo 5MB.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Evento'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
