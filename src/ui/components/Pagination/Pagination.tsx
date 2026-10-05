/** Tamaño de página por defecto, consistente con el catálogo de productos. */
export const DEFAULT_ITEMS_PER_PAGE = 12;

import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  /** Sustantivo para el contador ("productos", "marcas", ...). */
  itemLabel?: string;
}

/**
 * Controles de paginación client-side (mismo patrón/UI que el catálogo de
 * productos): contador "Mostrando X a Y de Z", botones Anterior/Siguiente y
 * números de página con elipsis. No se renderiza si hay una sola página.
 */
export const Pagination = ({
  currentPage,
  totalItems,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  onPageChange,
  itemLabel = 'productos',
}: PaginationProps) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const handlePageChange = (newPage: number) => {
    onPageChange(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.root}>
      <div className={styles.counter}>
        Mostrando{' '}
        <span className={styles.strong}>{(currentPage - 1) * itemsPerPage + 1}</span>{' '}
        a{' '}
        <span className={styles.strong}>
          {Math.min(currentPage * itemsPerPage, totalItems)}
        </span>{' '}
        de <span className={styles.strong}>{totalItems}</span> {itemLabel}
      </div>

      <div className={styles.controls}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={styles.navBtn}
        >
          &larr; Anterior
        </button>

        <div className={styles.pageNumbers}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            // Logica para mostrar botones de paginación [1] [2] ... [total]
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={[
                    styles.pageBtn,
                    currentPage === page ? styles.active : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {page}
                </button>
              );
            } else if (page === currentPage - 2 || page === currentPage + 2) {
              return (
                <span key={page} className={styles.ellipsis}>
                  ...
                </span>
              );
            }
            return null;
          })}
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={styles.navBtn}
        >
          Siguiente &rarr;
        </button>
      </div>
    </div>
  );
};
