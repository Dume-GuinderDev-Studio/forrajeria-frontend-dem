import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { roundToCents } from '@/lib/format';

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
  type CreateSupplierDebtPayload,
} from '@/infrastructure/supplier-debts.service';
import type { Supplier } from '@/infrastructure/suppliers.service';
import styles from './SupplierDebtDialog.module.css';

export interface SupplierDebtInitials {
  supplierId: string;
  description: string;
  /** Monto como texto de input (se parsea a número al guardar). */
  totalAmount: string;
  /**
   * Hasta qué fecha cubre esta deuda (ISO 8601). Solo lo manda "Rendición por
   * proveedor"; si viene vacío la clave no se envía y el backend guarda null.
   */
  covredUntil?: string | null;
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
    // El monto se redondea igual aunque venga precargado, porque el campo es
    // editable: si el usuario tipea un valor con más decimales, el backend lo
    // rechaza (totalAmount es @IsNumber({ maxDecimalPlaces: 2 })).
    const total = roundToCents(Number(form.totalAmount));
    if (!Number.isFinite(total) || total <= 0) {
      setFormError('El monto total debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      // La clave `covredUntil` solo se incluye cuando quien abrió el modal la
      // proveyó (ej. /admin/a-pagar no la tiene): mandar null explícito sería
      // indistinguible de un envío accidental y el backend lo guarda igual.
      const payload: CreateSupplierDebtPayload = {
        supplierId: form.supplierId,
        description: form.description.trim(),
        totalAmount: total,
      };
      if (form.covredUntil) payload.covredUntil = form.covredUntil;

      await createSupplierDebt(payload);
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
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Nueva deuda</DialogTitle>
          <DialogDescription>Registrá lo que se le debe a un proveedor.</DialogDescription>
        </DialogHeader>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Proveedor *</label>
            <Select
              value={form.supplierId}
              onValueChange={(value) => {
                setForm((current) => ({ ...current, supplierId: value }));
                if (formError) setFormError('');
              }}
            >
              <SelectTrigger className={styles.trigger}>
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

          <div className={styles.field}>
            <label className={styles.label}>Descripción *</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => {
                setForm((current) => ({ ...current, description: e.target.value }));
                if (formError) setFormError('');
              }}
              placeholder='Ej: Mercadería del 10/9'
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Monto total *</label>
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
              className={styles.input}
            />
          </div>

          {formError && <div className={styles.error}>{formError}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className={styles.spinner} />}
            Crear deuda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
