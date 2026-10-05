import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from './Pagination';

describe('Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('no renderiza nada cuando hay una sola página', () => {
    const { container } = render(
      <Pagination currentPage={1} totalItems={5} onPageChange={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('no renderiza nada cuando no hay items', () => {
    const { container } = render(
      <Pagination currentPage={1} totalItems={0} onPageChange={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el contador con el rango de la página actual', () => {
    render(<Pagination currentPage={1} totalItems={25} onPageChange={() => {}} />);

    expect(screen.getByText(/Mostrando/)).toHaveTextContent(
      'Mostrando 1 a 12 de 25 productos',
    );
  });

  it('muestra el rango correcto en páginas siguientes y el sustantivo indicado', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={25}
        onPageChange={() => {}}
        itemLabel="marcas"
      />,
    );

    expect(screen.getByText(/Mostrando/)).toHaveTextContent('Mostrando 13 a 24 de 25 marcas');
  });

  it('respeta el tamaño de página por defecto de productos (12)', () => {
    expect(DEFAULT_ITEMS_PER_PAGE).toBe(12);
  });

  it('llama onPageChange al clickear un número de página', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalItems={25} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('Anterior deshabilitado en la primera página y Siguiente avanza', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalItems={25} onPageChange={onPageChange} />);

    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('Siguiente deshabilitado en la última página', () => {
    render(<Pagination currentPage={3} totalItems={25} onPageChange={() => {}} />);

    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeEnabled();
  });

  it('muestra elipsis cuando hay muchas páginas', () => {
    render(<Pagination currentPage={5} totalItems={120} onPageChange={() => {}} />);

    expect(screen.getAllByText('...').length).toBeGreaterThan(0);
    // Primera y última página siempre visibles.
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });
});
