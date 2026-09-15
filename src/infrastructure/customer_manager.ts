import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { devLog, devWarn } from '@/infrastructure/utils/logger';

const CUSTOMER_STORAGE_KEY = 'customer-info-storage';

const isSessionStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__customer_storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    devWarn('[Customer] sessionStorage unavailable, using memory fallback (Safari ITP)');
    return false;
  }
};

const createSafeStorage = (): StateStorage => {
  if (isSessionStorageAvailable()) {
    return {
      getItem: (name: string): string | null => {
        try {
          return sessionStorage.getItem(name);
        } catch (e) {
          devWarn('[Customer] Error reading from sessionStorage:', e);
          return null;
        }
      },
      setItem: (name: string, value: string): void => {
        try {
          sessionStorage.setItem(name, value);
        } catch (e) {
          devWarn('[Customer] Error writing to sessionStorage:', e);
        }
      },
      removeItem: (name: string): void => {
        try {
          sessionStorage.removeItem(name);
        } catch (e) {
          devWarn('[Customer] Error removing from sessionStorage:', e);
        }
      },
    };
  }

  devLog('[Customer] Using in-memory storage (session/private mode)');
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

interface CustomerState {
  customerName: string;
  customerPhone: string;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setCustomerInfo: (name: string, phone: string) => void;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customerName: '',
      customerPhone: '',

      setCustomerName: (customerName) => set({ customerName }),

      setCustomerPhone: (customerPhone) => set({ customerPhone }),

      setCustomerInfo: (customerName, customerPhone) => set({ customerName, customerPhone }),
    }),
    {
      name: CUSTOMER_STORAGE_KEY,
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
);
