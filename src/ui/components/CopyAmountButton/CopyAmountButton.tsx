import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import styles from './CopyAmountButton.module.css';

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
      className={[styles.root, copied ? styles.copied : styles.idle].filter(Boolean).join(' ')}
    >
      {copied ? <Check className={styles.icon} /> : <Copy className={styles.icon} />}
    </button>
  );
};
