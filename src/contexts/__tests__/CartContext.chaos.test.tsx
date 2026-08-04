/**
 * Tier 4 — CartContext chaos tests.
 * Storage failure, long names, zero-price, massive quantity, boundary stock.
 */
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartProvider, useCart } from '../CartContext';
import { mockCartItem } from '../../__mocks__/merakiData';

let cart: ReturnType<typeof useCart>;
function Probe() {
    cart = useCart();
    return null;
}

const wrap = () =>
    render(
        <CartProvider>
            <Probe />
        </CartProvider>
    );

const storage = AsyncStorage as unknown as {
    getItem: jest.Mock;
    setItem: jest.Mock;
    removeItem: jest.Mock;
    clear: jest.Mock;
};

async function settle() {
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
}

describe('CartContext — storage failure resilience', () => {
    afterEach(async () => {
        await storage.clear();
        jest.clearAllMocks();
    });

    it('recovers from corrupted JSON in storage (cart starts empty, no throw)', async () => {
        await AsyncStorage.setItem('@meraki_cart', '{not valid json');
        await wrap();
        await settle();
        expect(cart.items).toEqual([]);
    });

    it('recovers when getItem rejects (storage offline)', async () => {
        storage.getItem.mockRejectedValueOnce(new Error('E_STORAGE_UNAVAILABLE'));
        await wrap();
        await settle();
        expect(cart.items).toEqual([]);
        expect(cart.getTotal()).toBe(0);
    });

    it('recovers when setItem rejects (writes fail silently, cart still usable)', async () => {
        await wrap();
        await settle();
        storage.setItem.mockRejectedValueOnce(new Error('E_DISK_FULL'));

        act(() => cart.addToCart(mockCartItem({ id: 'p1', price: 1 })));
        await settle();

        expect(cart.items).toHaveLength(1);
        expect(cart.getTotal()).toBe(1);
    });
});

describe('CartContext — boundary & chaos data', () => {
    afterEach(async () => {
        await storage.clear();
        jest.clearAllMocks();
    });

    it('stores extremely long product names intact (no truncation)', async () => {
        const longName = 'A'.repeat(500) + ' é ñ 中文 🧴';
        await wrap();
        await settle();
        act(() => cart.addToCart(mockCartItem({ id: 'p-long', name: longName })));
        expect(cart.items[0].name).toBe(longName);
    });

    it('handles zero-price products in totals', async () => {
        await wrap();
        await settle();
        act(() => cart.addToCart(mockCartItem({ id: 'free', price: 0 })));
        act(() => cart.addToCart(mockCartItem({ id: 'paid', price: 10 })));
        expect(cart.getTotal()).toBe(10);
        expect(cart.getItemCount()).toBe(2);
    });

    it('never accumulates past stock_count under rapid taps', async () => {
        await wrap();
        await settle();
        const product = mockCartItem({ id: 'stocked', stock_count: 3, price: 5 });

        for (let i = 0; i < 50; i++) {
            act(() => cart.addToCart(product));
        }

        expect(cart.items).toHaveLength(1);
        expect(cart.items[0].quantity).toBe(3);
        expect(cart.getTotal()).toBe(15); // 3 x €5 — must not charge for rejected taps
    });

    it('survives 100 distinct items (large basket)', async () => {
        await wrap();
        await settle();
        for (let i = 0; i < 100; i++) {
            act(() => cart.addToCart(mockCartItem({ id: `p${i}`, price: 1 })));
        }
        expect(cart.items).toHaveLength(100);
        expect(cart.getItemCount()).toBe(100);
        expect(cart.getTotal()).toBe(100);
    });

    it('quantity-0 removal via updateQuantity keeps other items intact', async () => {
        await wrap();
        await settle();
        act(() => cart.addToCart(mockCartItem({ id: 'keep' })));
        act(() => cart.addToCart(mockCartItem({ id: 'drop' })));

        act(() => cart.updateQuantity('drop', 0));

        expect(cart.items.map((i) => i.id)).toEqual(['keep']);
        expect(cart.getItemCount()).toBe(1);
    });

    it('negative quantity update acts as removal, not as a phantom item', async () => {
        await wrap();
        await settle();
        act(() => cart.addToCart(mockCartItem({ id: 'x' })));
        act(() => cart.updateQuantity('x', -5));
        expect(cart.items).toHaveLength(0);
    });
});

describe('CartContext — persistence round-trip', () => {
    afterEach(async () => {
        await storage.clear();
        jest.clearAllMocks();
    });

    it('writes cart JSON under @meraki_cart on change', async () => {
        await wrap();
        await settle();
        const item = mockCartItem({ id: 'persist-me', price: 9.5 });
        act(() => cart.addToCart(item));
        await settle();

        const raw = await AsyncStorage.getItem('@meraki_cart');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed[0].id).toBe('persist-me');
        expect(parsed[0].price).toBe(9.5);
    });

    it('rehydrates cart on fresh mount after a prior session wrote items', async () => {
        const saved = [mockCartItem({ id: 'restored', quantity: 2, price: 12 })];
        await AsyncStorage.setItem('@meraki_cart', JSON.stringify(saved));
        await wrap();
        await waitFor(() => expect(cart.items).toHaveLength(1));
        expect(cart.items[0].id).toBe('restored');
        expect(cart.items[0].quantity).toBe(2);
        expect(cart.getTotal()).toBe(24);
    });
});

