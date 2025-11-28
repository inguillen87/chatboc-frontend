import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Category {
  id: number;
  nombre: string;
}

const CategoryManagementPage: React.FC = () => {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ categorias: Category[] }>('/municipal/categorias', { sendEntityToken: true });
      setCategories(Array.isArray(data.categorias) ? data.categorias : []);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error al cargar las categorías.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.nombre);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setCategoryName('');
    setIsDialogOpen(true);
  };

  const handleDelete = async (categoryId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      return;
    }
    try {
      await apiFetch(`/municipal/categorias/${categoryId}`, { method: 'DELETE', sendEntityToken: true });
      fetchCategories();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error al eliminar la categoría.';
      setError(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCategory ? `/municipal/categorias/${editingCategory.id}` : '/municipal/categorias';
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      await apiFetch(url, {
        method,
        body: { nombre: categoryName },
        sendEntityToken: true,
      });
      fetchCategories();
      setIsDialogOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Ocurrió un error al guardar la categoría.';
      setError(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-primary h-16 w-16" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-destructive bg-destructive/10 rounded-md">{error}</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Gestión de Categorías</h1>
        <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4" /> Crear Categoría</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Las categorías se utilizan para organizar los tickets y asignarlos a los empleados adecuados.
        Crea y gestiona las categorías que los empleados podrán atender.
      </p>
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>{category.id}</TableCell>
                <TableCell className="font-medium">{category.nombre}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Crear Categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="py-4">
              <Input
                placeholder="Nombre de la categoría"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryManagementPage;
