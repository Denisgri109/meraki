'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const fallbackImage = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop';

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, clearCart, getItemCount, getTotal } = useCart();
  const subtotal = getTotal();

  if (items.length === 0) {
    return (
      <div className="animate-fade-in max-w-3xl mx-auto">
        <div className="glass-card p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-pink-100/60 to-transparent rounded-bl-full" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag size={34} className="text-[var(--color-brand-pink-dark)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Your bag is empty</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">Add curated beauty products from the shop before checkout.</p>
          <Link href="/dashboard/shop" className="btn-pink inline-flex items-center gap-2 px-7 py-3 text-sm">
            Browse Shop <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--color-brand-pink-dark)] mb-2">Shopping Bag</p>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Cart</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{getItemCount()} item{getItemCount() !== 1 ? 's' : ''} ready for checkout</p>
        </div>
        <button onClick={clearCart} className="btn-outline px-5 py-2.5 text-sm self-start sm:self-auto">
          Clear Cart
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="glass-card p-4 flex gap-4 items-center">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[var(--color-surface-light)] shrink-0">
                <img src={item.image_url || fallbackImage} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">MERAKÍ</p>
                    <h2 className="font-bold text-[var(--color-text-primary)] line-clamp-2">{item.name}</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">£{item.price.toFixed(2)} each</p>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-light)] p-1">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-pink-50">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock_count} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-pink-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-bold text-lg text-[var(--color-text-primary)]">£{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="glass-card p-6 sticky top-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center">
              <Package size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--color-text-primary)]">Order Summary</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Shipping added at checkout</p>
            </div>
          </div>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Shipping</span>
              <span>Calculated next</span>
            </div>
            <div className="border-t border-[var(--color-border-light)] pt-3 flex justify-between font-bold text-lg text-[var(--color-text-primary)]">
              <span>Total</span>
              <span>£{subtotal.toFixed(2)}+</span>
            </div>
          </div>

          <Link href="/dashboard/checkout" className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            Checkout <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard/shop" className="btn-outline w-full py-3 text-sm flex items-center justify-center mt-3">
            Continue Shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
