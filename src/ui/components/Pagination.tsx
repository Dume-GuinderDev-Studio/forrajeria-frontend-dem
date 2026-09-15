/** Tamaño de página por defecto, consistente con el catálogo de productos. */
export const DEFAULT_ITEMS_PER_PAGE = 12;

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
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Mostrando{' '}
        <span className="font-medium text-slate-900 dark:text-white">
          {(currentPage - 1) * itemsPerPage + 1}
        </span>{' '}
        a{' '}
        <span className="font-medium text-slate-900 dark:text-white">
          {Math.min(currentPage * itemsPerPage, totalItems)}
        </span>{' '}
        de{' '}
        <span className="font-medium text-slate-900 dark:text-white">{totalItems}</span>{' '}
        {itemLabel}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
        >
          &larr; Anterior
        </button>

        <div className="hidden sm:flex gap-1 items-center">
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
                  className={`w-8 h-8 flex items-center justify-center border rounded-md text-sm transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 border-blue-600 text-white font-medium shadow-sm'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              );
            } else if (page === currentPage - 2 || page === currentPage + 2) {
              return (
                <span key={page} className="px-1 text-slate-400 text-xs">
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
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
        >
          Siguiente &rarr;
        </button>
      </div>
    </div>
  );
};
