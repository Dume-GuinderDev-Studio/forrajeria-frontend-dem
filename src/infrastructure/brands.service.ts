import api from './api';

export interface Brand {
  id: string;
  name: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandPayload {
  name: string;
  supplierId?: string;
}

type BrandsResponse = Brand[] | { data?: Brand[] };

const normalizeList = (payload: BrandsResponse): Brand[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

/** Lista todas las marcas. GET /brands. */
export const getBrands = async (): Promise<Brand[]> => {
  const response = await api.get<BrandsResponse>('/brands');
  return normalizeList(response.data);
};

/** Crea una marca. POST /brands. */
export const createBrand = async (payload: BrandPayload): Promise<Brand> => {
  const response = await api.post<Brand>('/brands', payload);
  return response.data;
};

/** Actualiza una marca. PATCH /brands/:id. */
export const updateBrand = async (
  id: string,
  payload: Partial<BrandPayload>,
): Promise<Brand> => {
  const response = await api.patch<Brand>(`/brands/${id}`, payload);
  return response.data;
};

/** Elimina una marca. DELETE /brands/:id. */
export const deleteBrand = async (id: string): Promise<void> => {
  await api.delete(`/brands/${id}`);
};
