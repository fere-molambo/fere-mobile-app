import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import type { Product, Shop } from '@/types/database';

export interface CartItem {
  id: string;
  product: Product;
  shop: Shop;
  quantity: number;
  selectedColor: { name: string; hex: string } | null;
  selectedSize: string | null;
  proposedPrice: number | null;
  unitPrice: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateProposedPrice: (id: string, price: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  getItemsByShop: () => Map<string, { shop: Shop; items: CartItem[] }>;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'fere_cart';

function loadCartFromStorage(): CartItem[] {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
  }
  return [];
}

function saveCartToStorage(items: CartItem[]) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  const addToCart = useCallback((newItem: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === newItem.product.id &&
          item.selectedColor?.hex === newItem.selectedColor?.hex &&
          item.selectedSize === newItem.selectedSize
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + newItem.quantity,
          proposedPrice: newItem.proposedPrice ?? updated[existingIndex].proposedPrice,
        };
        return updated;
      }

      const id = `${newItem.product.id}_${newItem.selectedColor?.hex || 'nc'}_${newItem.selectedSize || 'ns'}_${Date.now()}`;
      return [...prev, { ...newItem, id }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, []);

  const updateProposedPrice = useCallback((id: string, price: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, proposedPrice: price } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setIsCartOpen(false);
  }, []);

  const getCartCount = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getSubtotal = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.proposedPrice || item.unitPrice) * item.quantity, 0);
  }, [items]);

  const getItemsByShop = useCallback(() => {
    const shopMap = new Map<string, { shop: Shop; items: CartItem[] }>();
    for (const item of items) {
      const shopId = item.shop.id;
      if (!shopMap.has(shopId)) {
        shopMap.set(shopId, { shop: item.shop, items: [] });
      }
      shopMap.get(shopId)!.items.push(item);
    }
    return shopMap;
  }, [items]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateProposedPrice,
        clearCart,
        getCartCount,
        getSubtotal,
        getItemsByShop,
        isCartOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
