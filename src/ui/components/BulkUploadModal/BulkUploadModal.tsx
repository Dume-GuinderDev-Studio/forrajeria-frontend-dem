import { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/ui/components/ui/button';
import { toast } from 'sonner';
import { bulkUploadProducts } from '@/infrastructure/products.service';
import { devError } from '@/infrastructure/utils/logger';
import styles from './BulkUploadModal.module.css';

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
    <div className={styles.root}>
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>Carga Masiva</h3>
              <p className={styles.headerSub}>Importar productos desde CSV</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={isUploading} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {!file ? (
            <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className={styles.hiddenInput}
                onChange={handleFileChange}
              />
              <div className={styles.dropIconWrap}>
                <Upload className={styles.dropIcon} size={32} />
              </div>
              <p className={styles.dropTitle}>Hacé clic para seleccionar</p>
              <p className={styles.dropSub}>o arrastrá tu archivo CSV acá</p>
              <p className={styles.dropHint}>
                <b>Importante:</b> La columna <b>categoria</b> debe ser estrictamente:{' '}
                <code>Perro</code>, <code>Gato</code>, <code>Accesorios</code> u <code>Otros</code>.{' '}
                <br />
                La columna <b>etapa_vida</b> debe ser: <code>All</code>, <code>Cachorro</code>,{' '}
                <code>Adulto</code> o <code>Senior</code>. <br />
                La columna <b>cost</b> es opcional (ej: <code>8500.50</code>).
              </p>
            </div>
          ) : (
            <div className={styles.fileView}>
              <div className={styles.fileCard}>
                <FileSpreadsheet className={styles.fileIcon} size={32} />
                <div className={styles.fileMeta}>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {!isUploading && (
                  <button onClick={() => setFile(null)} className={styles.removeBtn}>
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Progress */}
              {isUploading && (
                <div className={styles.progressWrap}>
                  <div className={styles.progressLabels}>
                    <span className={styles.progressText}>
                      {progress === 100 ? 'Completado!' : 'Subiendo y procesando...'}
                    </span>
                    <span className={styles.progressPct}>{progress}%</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            data-busy={isUploading}
            className={styles.uploadBtn}
          >
            {isUploading ? (
              progress === 100 ? (
                <>
                  <CheckCircle2 size={20} className={styles.btnIcon} /> Listo
                </>
              ) : (
                <>
                  <Loader2 size={18} className={[styles.btnIcon, styles.spin].filter(Boolean).join(' ')} /> Procesando
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
