import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

const COPIED_FEEDBACK_MS = 1500;

interface CopyAmountButtonProps {
  /** Texto ya formateado que se copia al portapapeles. */
  value: string;
  /** Descripción accesible del botón. */
  label?: string;
}

/**
 * Botón de copiar monto al portapapeles con feedback visual breve
 * (ícono Copy → Check por ~1.5s).
 */
export const CopyAmountButton = ({ value, label = 'Copiar monto' }: CopyAmountButtonProps) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      toast.error('No se pudo copiar el monto. Intentá nuevamente.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? '¡Copiado!' : 'Copiar'}
      aria-label={label}
      className={`rounded-md p-1 transition-colors ${
        copied
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
};
