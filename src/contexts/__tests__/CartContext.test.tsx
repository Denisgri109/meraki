/**
 * Cart Context Tests
 * Tests add, remove, update, clear, count, and total calculations
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { CartProvider, useCart, CartItem } from '../CartContext';

// Test data
const mockProduct1: CartItem = {
    id: 'prod_1',
    name: 'Gel Polish Set',
    price: 24.99,
    quantity: 1,
    image_url: null,
    stock_count: 10,
};

const mockProduct2: CartItem = {
    id: 'prod_2',
    name: 'Lash Extensions Kit',
    price: 49.99,
    quantity: 1,
    image_url: null,
    stock_count: 5,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CartProvider>{children}</CartProvider>
);

describe('CartContext', () => {
    // ═══════════════════════════════════════════════════════════════════
    // addToCart
    // ═══════════════════════════════════════════════════════════════════
    describe('addToCart', () => {
        it('adds a new product to cart', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });

            expect(result.current.items).toHaveLength(1);
            expect(result.current.items[0].id).toBe('prod_1');
            expect(result.current.items[0].quantity).toBe(1);
        });

        it('increments quantity when adding same product', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });
            act(() => {
                result.current.addToCart(mockProduct1);
            });

            expect(result.current.items).toHaveLength(1);
            expect(result.current.items[0].quantity).toBe(2);
        });

        it('does not exceed stock limit', () => {
            const limitedProduct: CartItem = { ...mockProduct1, stock_count: 2 };
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(limitedProduct);
            });
            act(() => {
                result.current.addToCart(limitedProduct);
            });
            act(() => {
                result.current.addToCart(limitedProduct); // Should be rejected
            });

            expect(result.current.items[0].quantity).toBe(2);
        });

        it('adds multiple different products', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });
            act(() => {
                result.current.addToCart(mockProduct2);
            });

            expect(result.current.items).toHaveLength(2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // removeFromCart
    // ═══════════════════════════════════════════════════════════════════
    describe('removeFromCart', () => {
        it('removes an item by id', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
                result.current.addToCart(mockProduct2);
            });
            act(() => {
                result.current.removeFromCart('prod_1');
            });

            expect(result.current.items).toHaveLength(1);
            expect(result.current.items[0].id).toBe('prod_2');
        });

        it('does nothing when removing non-existent item', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });
            act(() => {
                result.current.removeFromCart('nonexistent');
            });

            expect(result.current.items).toHaveLength(1);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // updateQuantity
    // ═══════════════════════════════════════════════════════════════════
    describe('updateQuantity', () => {
        it('updates quantity for an item', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });
            act(() => {
                result.current.updateQuantity('prod_1', 5);
            });

            expect(result.current.items[0].quantity).toBe(5);
        });

        it('removes item when quantity set to 0', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
            });
            act(() => {
                result.current.updateQuantity('prod_1', 0);
            });

            expect(result.current.items).toHaveLength(0);
        });

        it('clamps quantity to stock count', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1); // stock_count: 10
            });
            act(() => {
                result.current.updateQuantity('prod_1', 99);
            });

            expect(result.current.items[0].quantity).toBe(10);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // clearCart
    // ═══════════════════════════════════════════════════════════════════
    describe('clearCart', () => {
        it('clears all items', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
                result.current.addToCart(mockProduct2);
            });
            act(() => {
                result.current.clearCart();
            });

            expect(result.current.items).toHaveLength(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // getItemCount
    // ═══════════════════════════════════════════════════════════════════
    describe('getItemCount', () => {
        it('returns 0 for empty cart', () => {
            const { result } = renderHook(() => useCart(), { wrapper });
            expect(result.current.getItemCount()).toBe(0);
        });

        it('sums up all item quantities', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1);
                result.current.addToCart(mockProduct2);
            });
            act(() => {
                result.current.updateQuantity('prod_1', 3);
            });

            expect(result.current.getItemCount()).toBe(4); // 3 + 1
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // getTotal
    // ═══════════════════════════════════════════════════════════════════
    describe('getTotal', () => {
        it('returns 0 for empty cart', () => {
            const { result } = renderHook(() => useCart(), { wrapper });
            expect(result.current.getTotal()).toBe(0);
        });

        it('calculates total correctly', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1); // 24.99 x 1
                result.current.addToCart(mockProduct2); // 49.99 x 1
            });

            expect(result.current.getTotal()).toBeCloseTo(74.98, 2);
        });

        it('updates total when quantity changes', () => {
            const { result } = renderHook(() => useCart(), { wrapper });

            act(() => {
                result.current.addToCart(mockProduct1); // 24.99
            });
            act(() => {
                result.current.updateQuantity('prod_1', 3); // 24.99 x 3
            });

            expect(result.current.getTotal()).toBeCloseTo(74.97, 2);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // useCart outside provider
    // ═══════════════════════════════════════════════════════════════════
    describe('useCart outside CartProvider', () => {
        it('throws error when used outside CartProvider', () => {
            // Suppress console.error for the expected error
            const spy = jest.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                renderHook(() => useCart());
            }).toThrow('useCart must be used within a CartProvider');

            spy.mockRestore();
        });
    });
});
