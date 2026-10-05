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
import styles from './BrandsPage.module.css';

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

  // Un único mensaje de estado vacío, compartido por tabla y cards de mobile.
  const emptyBrandsMessage = 'No se encontraron marcas coincidentes con la búsqueda.';

  return (
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Marcas</h1>
              <p className={styles.subtitle}>
                Administrá las marcas de tus productos y su proveedor.
              </p>
            </div>
            <div className={styles.headerActions}>
              <Button variant="outline" onClick={loadBrands} disabled={loading}>
                <RefreshCw className={styles.btnIcon} data-spin={loading} />
                Actualizar
              </Button>
              <Button onClick={openCreate}>
                <Plus className={styles.btnIcon} />
                Nueva marca
              </Button>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando marcas...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadBrands} className={styles.retryBtn}>
                <RefreshCw className={styles.btnIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : brands.length === 0 ? (
            <div className={styles.stateBox}>
              <Tags className={styles.stateIcon} />
              <p>Todavía no hay marcas cargadas.</p>
              <Button onClick={openCreate} className={styles.ctaBtn}>
                <Plus className={styles.btnIcon} />
                Nueva marca
              </Button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <div className={styles.toolbar}>
                <div className={styles.searchWrap}>
                  <Search className={styles.searchIcon} size={18} />
                  <input
                    type="text"
                    placeholder="Buscar marca..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>
              <>
              {/* Mobile: una card por marca. La tabla de desktop queda debajo. */}
              <ul className={styles.cardList}>
                {filteredBrands.length === 0 ? (
                  <li className={[styles.card, styles.emptyCard].filter(Boolean).join(' ')}>
                    {emptyBrandsMessage}
                  </li>
                ) : (
                  currentBrands.map((brand) => (
                    <li key={brand.id} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div className={styles.cardName} title={brand.name}>{brand.name}</div>
                        <div className={styles.cardActions}>
                          <BrandRowActions brand={brand} onEdit={openEdit} onDelete={setDeleteTarget} />
                        </div>
                      </div>

                      <div className={styles.cardMeta}>
                        <span>{getBrandSupplierName(brand)}</span>
                        <span className={styles.cardDate}>Alta: {formatDate(brand.createdAt)}</span>
                      </div>
                    </li>
                  ))
                )}
              </ul>

              <div className={styles.tableDesktop}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead className={styles.cellRight}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrands.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className={styles.emptyRow}>
                        {emptyBrandsMessage}
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBrands.map((brand) => (
                    <TableRow key={brand.id}>
                      <TableCell className={styles.cellName}>
                        <div className={styles.cellNameText} title={brand.name}>
                          {brand.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={styles.cellNameText}>{getBrandSupplierName(brand)}</div>
                      </TableCell>
                      <TableCell>{formatDate(brand.createdAt)}</TableCell>
                      <TableCell className={styles.cellRight}>
                        <BrandRowActions brand={brand} onEdit={openEdit} onDelete={setDeleteTarget} />
                      </TableCell>
                    </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              </>
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
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar marca' : 'Nueva marca'}</DialogTitle>
            <DialogDescription>
              {editing ? `Modificá los datos de ${editing.name}.` : 'Completá los datos de la marca.'}
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
                placeholder="Ej: Royal Canin"
                className={styles.dialogInput}
              />
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Proveedor (opcional)</label>
              <Select
                value={form.supplierId ?? NO_SUPPLIER_VALUE}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    supplierId: value === NO_SUPPLIER_VALUE ? null : value,
                  }))
                }
              >
                <SelectTrigger className={styles.trigger}>
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

interface BrandRowActionsProps {
  brand: Brand;
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
}

/** Editar y eliminar. Compartidos por la tabla y la card de mobile. */
const BrandRowActions = ({ brand, onEdit, onDelete }: BrandRowActionsProps) => (
  <div className={styles.rowActions}>
    <Button variant="outline" size="sm" onClick={() => onEdit(brand)}>
      <Pencil className={styles.btnIcon} />
      Editar
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => onDelete(brand)}
      aria-label={`Eliminar ${brand.name}`}
    >
      <Trash2 className={styles.trashIcon} />
    </Button>
  </div>
);