import api from './api';

export interface Supplier {
  id: string;
  name: string;
  contactPhone?: string | null;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayload {
  name: string;
  contactPhone?: string;
  notes?: string;
}

type SuppliersResponse = Supplier[] | { data?: Supplier[] };

const normalizeList = (payload: SuppliersResponse): Supplier[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/** Lista todos los proveedores. GET /suppliers. */
export const getSuppliers = async (): Promise<Supplier[]> => {
  const response = await api.get<SuppliersResponse>('/suppliers');
  return normalizeList(response.data);
};

/** Crea un proveedor. POST /suppliers. */
export const createSupplier = async (payload: SupplierPayload): Promise<Supplier> => {
  const response = await api.post<Supplier>('/suppliers', payload);
  return response.data;
};

/** Actualiza un proveedor. PATCH /suppliers/:id. */
export const updateSupplier = async (
  id: string,
  payload: Partial<SupplierPayload>,
): Promise<Supplier> => {
  const response = await api.patch<Supplier>(`/suppliers/${id}`, payload);
  return response.data;
};

/** Elimina un proveedor. DELETE /suppliers/:id. */
export const deleteSupplier = async (id: string): Promise<void> => {
  await api.delete(`/suppliers/${id}`);
};
