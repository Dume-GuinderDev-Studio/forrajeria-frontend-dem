import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
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
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
  type Supplier,
} from '@/infrastructure/suppliers.service';

interface SupplierFormState {
  name: string;
  contactPhone: string;
  notes: string;
}

const EMPTY_FORM: SupplierFormState = { name: '', contactPhone: '', notes: '' };

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = DEFAULT_ITEMS_PER_PAGE;

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch {
      setSuppliers([]);
      setError('No se pudieron cargar los proveedores. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsDialogOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name ?? '',
      contactPhone: supplier.contactPhone ?? '',
      notes: supplier.notes ?? '',
    });
    setFormError('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;

    if (form.name.trim().length === 0) {
      setFormError('El nombre del proveedor es obligatorio.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      name: form.name.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    try {
      if (editing) {
        await updateSupplier(editing.id, payload);
        toast.success('Proveedor actualizado correctamente');
      } else {
        await createSupplier(payload);
        toast.success('Proveedor creado correctamente');
      }
      setIsDialogOpen(false);
      await loadSuppliers();
    } catch {
      setFormError(
        editing
          ? 'No se pudo actualizar el proveedor. Intentá nuevamente.'
          : 'No se pudo crear el proveedor. Intentá nuevamente.',
      );
    } finally {
      setSaving(false);
    }
  };

  // Paginación client-side sobre la lista completa (igual que marcas:
  // /suppliers no soporta page/limit en el backend). Sin buscador en esta
  // vista, no hay filtro que resetee la página.
  const currentSuppliers = suppliers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await deleteSupplier(deleteTarget.id);
      toast.success('Proveedor eliminado correctamente');
      setDeleteTarget(null);
      await loadSuppliers();
    } catch {
      toast.error('No se pudo eliminar el proveedor. Intentá nuevamente.');
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
                Proveedores
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Administrá los proveedores de tus productos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadSuppliers} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Nuevo proveedor
              </Button>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando proveedores...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadSuppliers} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Truck className="w-10 h-10 mb-4" />
              <p>Todavía no hay proveedores cargados.</p>
              <Button onClick={openCreate} className="mt-4">
                <Plus className="size-4" />
                Nuevo proveedor
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        {supplier.name}
                      </TableCell>
                      <TableCell>{supplier.contactPhone || '—'}</TableCell>
                      <TableCell className="max-w-56 truncate" title={supplier.notes ?? undefined}>
                        {supplier.notes || '—'}
                      </TableCell>
                      <TableCell>{formatDate(supplier.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(supplier)}>
                            <Pencil className="size-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(supplier)}
                            aria-label={`Eliminar ${supplier.name}`}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                currentPage={currentPage}
                totalItems={suppliers.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="proveedores"
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
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Modificá los datos de ${editing.name}.`
                : 'Completá los datos del proveedor.'}
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
                placeholder="Ej: Distribuidora Sur"
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Teléfono (opcional)
              </label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((current) => ({ ...current, contactPhone: e.target.value }))
                }
                placeholder="Ej: 11 2345 6789"
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Notas (opcional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Ej: Entrega los martes, pedir factura"
                rows={3}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
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
              {editing ? 'Guardar cambios' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Eliminar proveedor"
        description={`¿Seguro que querés eliminar a ${deleteTarget?.name}? Esta acción no se puede deshacer.`}
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
};
