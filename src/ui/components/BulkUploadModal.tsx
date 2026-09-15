import { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { toast } from 'sonner';
import { bulkUploadProducts } from '@/infrastructure/products.service';
import { devError } from '@/infrastructure/utils/logger';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkUploadModal = ({ isOpen, onClose, onSuccess }: BulkUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 10;
      });
    }, 100);

    try {
      await bulkUploadProducts(file);
      clearInterval(interval);
      setProgress(100);
      toast.success('Carga masiva completada exitosamente! 🚀');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 800);
    } catch (error: unknown) {
      clearInterval(interval);
      setIsUploading(false);
      setProgress(0);
      devError('Error uploading CSV:', error);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al procesar el archivo.';
      toast.error(`Error: ${msg}`);
    }
  };

  const handleClose = () => {
    setFile(null);
    setProgress(0);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Carga Masiva</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Importar productos desde CSV
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!file ? (
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-10 flex flex-col items-center text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-blue-400 transition-all group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="text-blue-600 dark:text-blue-400" size={32} />
              </div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                Hacé clic para seleccionar
              </p>
              <p className="text-sm text-slate-500 mt-1">o arrastrá tu archivo CSV acá</p>
              <p className="text-xs text-slate-400 mt-4 max-w-sm leading-relaxed">
                <b>Importante:</b> La columna <b>categoria</b> debe ser estrictamente:{' '}
                <code>Perro</code>, <code>Gato</code>, <code>Accesorios</code> u <code>Otros</code>.{' '}
                <br />
                La columna <b>etapa_vida</b> debe ser: <code>All</code>, <code>Cachorro</code>,{' '}
                <code>Adulto</code> o <code>Senior</code>. <br />
                La columna <b>cost</b> es opcional (ej: <code>8500.50</code>).
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <FileSpreadsheet className="text-green-600" size={32} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 dark:text-white truncate">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {!isUploading && (
                  <button onClick={() => setFile(null)} className="text-red-500 hover:text-red-700">
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-blue-600 dark:text-blue-400">
                      {progress === 100 ? 'Completado!' : 'Subiendo y procesando...'}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className={`bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] ${isUploading ? 'opacity-90' : ''}`}
          >
            {isUploading ? (
              progress === 100 ? (
                <>
                  <CheckCircle2 size={20} className="mr-2" /> Listo
                </>
              ) : (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" /> Procesando
                </>
              )
            ) : (
              'Subir Archivo'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
