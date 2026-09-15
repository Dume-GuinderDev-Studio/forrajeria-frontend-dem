import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tags,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/ui/components/Pagination';
import { Button } from '@/ui/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';
import {
  createBrand,
  deleteBrand,
  getBrands,
  updateBrand,
  type Brand,
} from '@/infrastructure/brands.service';
import { getSuppliers, type Supplier } from '@/infrastructure/suppliers.service';

/** Valor centinela del Select para "Sin proveedor" (los items no aceptan string vacío). */
const NO_SUPPLIER_VALUE = '__none';

interface BrandFormState {
  name: string;
  supplierId: string | null;
}

const EMPTY_FORM: BrandFormState = { name: '', supplierId: null };

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getBrandSupplierName = (brand: Brand): string => brand.supplier?.name ?? '—';

export const BrandsPage = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = DEFAULT_ITEMS_PER_PAGE;

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [brandsData, suppliersData] = await Promise.all([getBrands(), getSuppliers()]);
      setBrands(brandsData);
      setSuppliers(suppliersData);
    } catch {
      setBrands([]);
      setError('No se pudieron cargar las marcas. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setForm({
      name: brand.name ?? '',
      supplierId: brand.supplier?.id ?? brand.supplierId ?? null,
    });
    setFormError('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;

    if (form.name.trim().length === 0) {
      setFormError('El nombre de la marca es obligatorio.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      supplierId: form.supplierId ?? undefined,
    };

    try {
      if (editing) {
        await updateBrand(editing.id, payload);
        toast.success('Marca actualizada correctamente');
      } else {
        await createBrand(payload);
        toast.success('Marca creada correctamente');
      }
      setIsDialogOpen(false);
      await loadBrands();
    } catch {
      setFormError(
        editing
          ? 'No se pudo actualizar la marca. Intentá nuevamente.'
          : 'No se pudo crear la marca. Intentá nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Paginación client-side sobre los resultados ya filtrados (igual que el
  // catálogo de productos: /brands no soporta page/limit en el backend).
  const currentBrands = filteredBrands.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Resetear a página 1 al escribir en el buscador.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await deleteBrand(deleteTarget.id);
      toast.success('Marca eliminada correctamente');
      setDeleteTarget(null);
      await loadBrands();
    } catch {
      toast.error('No se pudo eliminar la marca. Intentá nuevamente.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Marcas
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Administrá las marcas de tus productos y su proveedor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadBrands} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Nueva marca
              </Button>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando marcas...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadBrands} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Tags className="w-10 h-10 mb-4" />
              <p>Todavía no hay marcas cargadas.</p>
              <Button onClick={openCreate} className="mt-4">
                <Plus className="size-4" />
                Nueva marca
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar marca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrands.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        No se encontraron marcas coincidentes con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBrands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        {brand.name}
                      </TableCell>
                      <TableCell>{getBrandSupplierName(brand)}</TableCell>
                      <TableCell>{formatDate(brand.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(brand)}>
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(brand)}
                            aria-label={`Eliminar ${brand.name}`}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredBrands.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="marcas"
              />
            </div>
          )}
        </div>
      </main>

      {/* Create / edit dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setIsDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar marca' : 'Nueva marca'}</DialogTitle>
            <DialogDescription>
              {editing ? `Modificá los datos de ${editing.name}.` : 'Completá los datos de la marca.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Nombre *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((current) => ({ ...current, name: e.target.value }));
                  if (formError) setFormError('');
                }}
                placeholder="Ej: Royal Canin"
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Proveedor (opcional)
              </label>
              <Select
                value={form.supplierId ?? NO_SUPPLIER_VALUE}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    supplierId: value === NO_SUPPLIER_VALUE ? null : value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SUPPLIER_VALUE}>Sin proveedor</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear marca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar marca"
        description={`¿Seguro que querés eliminar la marca ${deleteTarget?.name}? Esta acción no se puede deshacer.`}
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
};
