import { describe, expect, it } from 'vitest';
import { productSchema } from './ProductForm';

const validProduct = {
  name: 'Royal Canin Cachorro 15kg',
  price: 1000,
  stock: 10,
  categoryId: 'cat-1',
  lifeStage: 'Cachorro',
  image: '',
};

describe('productSchema', () => {
  it('acepta un producto válido', () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = productSchema.safeParse({ ...validProduct, name: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El nombre es obligatorio');
    }
  });

  it('rechaza precio 0 o negativo', () => {
    expect(productSchema.safeParse({ ...validProduct, price: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, price: -5 }).success).toBe(false);
  });

  it('rechaza stock negativo', () => {
    expect(productSchema.safeParse({ ...validProduct, stock: -1 }).success).toBe(false);
  });

  it('rechaza categoría vacía', () => {
    expect(productSchema.safeParse({ ...validProduct, categoryId: '' }).success).toBe(false);
  });

  it('rechaza etapa de vida inválida', () => {
    expect(productSchema.safeParse({ ...validProduct, lifeStage: 'Bebé' }).success).toBe(false);
  });

  it('rechaza URL de imagen inválida pero acepta vacía, null o undefined', () => {
    expect(productSchema.safeParse({ ...validProduct, image: 'no-es-url' }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, image: '' }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, image: null }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, image: undefined }).success).toBe(true);
  });
});
