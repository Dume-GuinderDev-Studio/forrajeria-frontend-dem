import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { devLog, devWarn } from '@/infrastructure/utils/logger';

export type Unit = 'Bolsa' | 'Kilo' | 'Unidad';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unit: Unit;
  price: number;
  image?: string;
  // Campos para presentaciones
  presentationId?: string;
  presentationType?: 'bag' | 'kilo';
  weightKg?: number | null;
  // Bolsa abierta del producto al momento de agregar (informativo).
  openBagRemainingKg?: number | null;
}

const CART_VERSION = 1;
const CART_STORAGE_KEY = 'cart-storage';

const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__cart_storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    devWarn('[Cart] localStorage unavailable, using memory fallback (Safari ITP)');
    return false;
  }
};

const createSafeStorage = (): StateStorage => {
  if (isLocalStorageAvailable()) {
    return {
      getItem: (name: string): string | null => {
        try {
          return localStorage.getItem(name);
        } catch (e) {
          devWarn('[Cart] Error reading from localStorage:', e);
          return null;
        }
      },
      setItem: (name: string, value: string): void => {
        try {
          localStorage.setItem(name, value);
        } catch (e) {
          devWarn('[Cart] Error writing to localStorage:', e);
        }
      },
      removeItem: (name: string): void => {
        try {
          localStorage.removeItem(name);
        } catch (e) {
          devWarn('[Cart] Error removing from localStorage:', e);
        }
      },
    };
  }

  devLog('[Cart] Using in-memory storage (Safari/private mode)');
  const memoryStorage: Record<string, string> = {};
  return {
    getItem: (name: string): string | null => memoryStorage[name] || null,
    setItem: (name: string, value: string): void => {
      memoryStorage[name] = value;
    },
    removeItem: (name: string): void => {
      delete memoryStorage[name];
    },
  };
};

const cartStorage = createSafeStorage();

interface CartState {
  items: CartItem[];
  version: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string, unit: Unit) => void;
  updateQuantity: (productId: string, unit: Unit, delta: number) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      version: CART_VERSION,

      addItem: (newItem) => {
        set((state) => {
          const existingItem = state.items.find(
            (item) => item.productId === newItem.productId && item.unit === newItem.unit,
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.productId === newItem.productId && item.unit === newItem.unit
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              ),
            };
          } else {
            return {
              items: [...state.items, { ...newItem, quantity: 1 }],
            };
          }
        });
      },

      removeItem: (productId, unit) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.productId === productId && item.unit === unit),
          ),
        }));
      },

      updateQuantity: (productId, unit, delta) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId === productId && item.unit === unit) {
              const newQuantity = Math.max(1, item.quantity + delta);
              return { ...item, quantity: newQuantity };
            }
            return item;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => cartStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.version !== CART_VERSION) {
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
          } catch (e) {
            devWarn('[Cart] Error clearing storage:', e);
          }
          state.items = [];
          state.version = CART_VERSION;
        }
      },
    },
  ),
);
