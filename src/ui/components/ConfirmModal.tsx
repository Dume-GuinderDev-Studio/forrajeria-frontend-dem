import React from 'react';
import ReactDOM from 'react-dom';

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

  const confirmButtonColor =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-amber-500 hover:bg-amber-600 text-white';

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      ></div>

      {/* Modal Content */}
      <div className="relative z-[10000] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg w-full mx-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
          {description}
        </p>

        <div className="flex justify-end gap-3 font-medium">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel(); // auto-close on confirm
            }}
            className={`px-4 py-2 rounded-xl transition-colors ${confirmButtonColor}`}
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
