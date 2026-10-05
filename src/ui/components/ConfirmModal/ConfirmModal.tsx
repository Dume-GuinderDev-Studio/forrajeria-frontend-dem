import React from 'react';
import ReactDOM from 'react-dom';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const modalContent = (
    <div className={styles.root}>
      {/* Overlay */}
      <div className={styles.overlay} onClick={onCancel}></div>

      {/* Modal Content */}
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>

        <div className={styles.actions}>
          <button onClick={onCancel} className={styles.cancelBtn}>
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel(); // auto-close on confirm
            }}
            className={[styles.confirmBtn, styles[variant]].filter(Boolean).join(' ')}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // Render globally independent of stacking contexts
  return ReactDOM.createPortal(modalContent, document.body);
};
