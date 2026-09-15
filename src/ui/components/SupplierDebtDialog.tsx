import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/ui/button';
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
  createSupplierDebt,
  getSupplierDebtsErrorMessage,
} from '@/infrastructure/supplier-debts.service';
import type { Supplier } from '@/infrastructure/suppliers.service';

export interface SupplierDebtInitials {
  supplierId: string;
  description: string;
  /** Monto como texto de input (se parsea a número al guardar). */
  totalAmount: string;
}

export const EMPTY_DEBT_INITIALS: SupplierDebtInitials = {
  supplierId: '',
  description: '',
  totalAmount: '',
};

interface SupplierDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Proveedores para el selector (ya filtrados si corresponde). */
  suppliers: Supplier[];
  /** Valores con los que se pre-carga el formulario al abrir. */
  initials?: SupplierDebtInitials;
  /** Se invoca tras crear la deuda (ej. para recargar el listado). */
  onCreated?: () => void | Promise<void>;
}

/**
 * Modal "Nueva deuda" reutilizable (extraído de /admin/a-pagar). El usuario
 * siempre revisa y confirma el formulario: nunca crea la deuda solo con
 * abrirlo. Los valores iniciales permiten pre-cargarlo desde otras vistas
 * (ej. "Registrar deuda" en Rendición por proveedor).
 */
export const SupplierDebtDialog = ({
  open,
  onOpenChange,
  suppliers,
  initials = EMPTY_DEBT_INITIALS,
  onCreated,
}: SupplierDebtDialogProps) => {
  const [form, setForm] = useState<SupplierDebtInitials>(initials);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-cargar el formulario cada vez que se abre (con los initials vigentes).
  useEffect(() => {
    if (open) {
      setForm(initials);
      setFormError('');
    }
  }, [open, initials]);

  const handleSave = async () => {
    if (saving) return;

    if (!form.supplierId) {
      setFormError('Seleccioná un proveedor.');
      return;
    }
    if (form.description.trim().length === 0) {
      setFormError('La descripción es obligatoria (ej. "Mercadería del 10/9").');
      return;
    }
    const total = Number(form.totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      setFormError('El monto total debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await createSupplierDebt({
        supplierId: form.supplierId,
        description: form.description.trim(),
        totalAmount: total,
      });
      toast.success('Deuda registrada correctamente');
      onOpenChange(false);
      await onCreated?.();
    } catch (err) {
      setFormError(
        getSupplierDebtsErrorMessage(err, 'No se pudo registrar la deuda. Intentá nuevamente.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva deuda</DialogTitle>
          <DialogDescription>Registrá lo que se le debe a un proveedor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Proveedor *
            </label>
            <Select
              value={form.supplierId}
              onValueChange={(value) => {
                setForm((current) => ({ ...current, supplierId: value }));
                if (formError) setFormError('');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un proveedor" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Descripción *
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => {
                setForm((current) => ({ ...current, description: e.target.value }));
                if (formError) setFormError('');
              }}
              placeholder='Ej: Mercadería del 10/9'
              className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Monto total *
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => {
                setForm((current) => ({ ...current, totalAmount: e.target.value }));
                if (formError) setFormError('');
              }}
              placeholder="Ej: 50000"
              className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {formError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Crear deuda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
