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
import styles from './SuppliersPage.module.css';

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

/** Botones de editar y eliminar. Compartidos por la tabla y la card de mobile. */
const SupplierRowActions = ({
  supplier,
  onEdit,
  onDelete,
}: {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}) => (
  <div className={styles.rowActions}>
    <Button variant="outline" size="sm" onClick={() => onEdit(supplier)}>
      <Pencil className={styles.btnIcon} />
      Editar
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onDelete(supplier)}
      aria-label={`Eliminar ${supplier.name}`}
    >
      <Trash2 className={styles.trashIcon} />
    </Button>
  </div>
);


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
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Proveedores</h1>
              <p className={styles.subtitle}>Administrá los proveedores de tus productos.</p>
            </div>
            <div className={styles.headerActions}>
              <Button variant="outline" onClick={loadSuppliers} disabled={loading}>
                <RefreshCw className={styles.btnIcon} data-spin={loading} />
                Actualizar
              </Button>
              <Button onClick={openCreate}>
                <Plus className={styles.btnIcon} />
                Nuevo proveedor
              </Button>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando proveedores...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadSuppliers} className={styles.retryBtn}>
                <RefreshCw className={styles.btnIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : suppliers.length === 0 ? (
            <div className={styles.stateBox}>
              <Truck className={styles.stateIcon} />
              <p>Todavía no hay proveedores cargados.</p>
              <Button onClick={openCreate} className={styles.ctaBtn}>
                <Plus className={styles.btnIcon} />
                Nuevo proveedor
              </Button>
            </div>
          ) : (
            <>
            {/* Mobile: una card por proveedor. La tabla de desktop queda debajo. */}
            <ul className={styles.cardList}>
              {currentSuppliers.map((supplier) => (
                <li key={supplier.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardName}>{supplier.name}</div>
                    <div className={styles.cardActions}>
                      <SupplierRowActions
                        supplier={supplier}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <span>{supplier.contactPhone || '—'}</span>
                    <span className={styles.cardNotes} title={supplier.notes ?? undefined}>
                      {supplier.notes || '—'}
                    </span>
                    <span className={styles.cardDate}>Alta: {formatDate(supplier.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.tableDesktop}>
            <div className={styles.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className={styles.cellRight}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className={styles.cellName}>
                        <div className={styles.cellNameText} title={supplier.name}>
                          {supplier.name}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.contactPhone || '—'}</TableCell>
                      <TableCell className={styles.cellNotes}>
                        <div className={styles.cellNotesText} title={supplier.notes ?? undefined}>
                          {supplier.notes || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(supplier.createdAt)}</TableCell>
                      <TableCell className={styles.cellRight}>
                        <SupplierRowActions
                              supplier={supplier}
                              onEdit={openEdit}
                              onDelete={setDeleteTarget}
                        />
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
            </div>
            </>
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
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Modificá los datos de ${editing.name}.`
                : 'Completá los datos del proveedor.'}
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogForm}>
            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((current) => ({ ...current, name: e.target.value }));
                  if (formError) setFormError('');
                }}
                placeholder="Ej: Distribuidora Sur"
                className={styles.dialogInput}
              />
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Teléfono (opcional)</label>
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((current) => ({ ...current, contactPhone: e.target.value }))
                }
                placeholder="Ej: 11 2345 6789"
                className={styles.dialogInput}
              />
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Notas (opcional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Ej: Entrega los martes, pedir factura"
                rows={3}
                className={styles.dialogArea}
              />
            </div>

            {formError && <div className={styles.dialogError}>{formError}</div>}
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
              {saving && <Loader2 className={styles.btnIcon} data-spin={true} />}
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
