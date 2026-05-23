'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  stock_count: number;
}

interface AddToCartProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock_count: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: AddToCartProduct) => boolean;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = 'meraki_web_cart';

function loadStoredItems() {
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as CartItem[];
    return parsed.filter((item) => item.id && item.quantity > 0);
  } catch (error) {
    console.error('Error loading cart:', error);
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setItems(loadStoredItems());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  }, [hydrated, items]);

  const addToCart = (product: AddToCartProduct) => {
    const stockCount = Math.max(0, product.stock_count);
    const existingItem = items.find((item) => item.id === product.id);

    if (stockCount === 0 || (existingItem && existingItem.quantity >= stockCount)) {
      return false;
    }

    setItems((currentItems) => {
      const currentExisting = currentItems.find((item) => item.id === product.id);
      if (currentExisting) {
        return currentItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, stockCount), stock_count: stockCount, price: product.price }
            : item
        );
      }
      return [...currentItems, { ...product, stock_count: stockCount, quantity: 1 }];
    });

    return true;
  };

  const removeFromCart = (productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.min(quantity, item.stock_count) }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const value: CartContextType = {
    items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getItemCount: () => items.reduce((total, item) => total + item.quantity, 0),
    getTotal: () => items.reduce((total, item) => total + item.price * item.quantity, 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
