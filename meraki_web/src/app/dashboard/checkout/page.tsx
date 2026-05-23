'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MapPin, Package, ShoppingBag, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import { EUROPEAN_COUNTRIES_SORTED, getCountryName, getShippingCost } from '@/lib/shipping';
import type { SavedCard } from '@/components/PaymentMethodsManager';
import { CardBrandBadge } from '@/components/PaymentMethodsManager';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const fallbackImage = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function CheckoutForm() {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const supabase = createClient();
  const { user, profile } = useAuth();
  const { items, getTotal, clearCart } = useCart();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [shippingName, setShippingName] = useState(profile?.full_name || '');
  const [shippingPhone, setShippingPhone] = useState(profile?.phone || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState(profile?.city || '');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('GB');
  const [notes, setNotes] = useState('');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selectedPm, setSelectedPm] = useState<string>('new');

  const usingSavedCard = selectedPm !== 'new';

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('list-payment-methods', { body: {} });
        if (!error && data?.paymentMethods?.length) {
          setSavedCards(data.paymentMethods);
          const def = data.paymentMethods.find((c: SavedCard) => c.isDefault);
          setSelectedPm(def ? def.id : data.paymentMethods[0].id);
        }
      } catch { /* ignore */ }
      setLoadingCards(false);
    };
    load();
  }, [supabase]);

  const subtotal = getTotal();
  const shippingCost = getShippingCost(shippingCountry);
  const finalTotal = subtotal + shippingCost;

  const cardOptions = useMemo(() => ({
    style: {
      base: {
        fontSize: '16px',
        color: '#1A1A1A',
        '::placeholder': { color: '#9CA3AF' },
      },
      invalid: { color: '#EF4444' },
    },
  }), []);

  const validate = () => {
    if (!user) return 'Please log in to checkout.';
    if (items.length === 0) return 'Your cart is empty.';
    if (!shippingName.trim()) return 'Enter recipient full name.';
    if (!shippingPhone.trim()) return 'Enter delivery phone number.';
    if (!shippingAddress.trim()) return 'Enter street address.';
    if (!shippingCity.trim()) return 'Enter city.';
    if (!shippingPostalCode.trim()) return 'Enter postal code.';
    if (!stripe) return 'Stripe is still loading. Try again in a moment.';
    if (!usingSavedCard && !elements) return 'Stripe is still loading. Try again in a moment.';
    return null;
  };

  const checkStock = async () => {
    const itemIds = items.map((item) => item.id);
    const { data, error } = await supabase
      .from('products')
      .select('id, stock_count')
      .in('id', itemIds);

    if (error) throw new Error('Could not verify stock for items');

    const stockMap = new Map((data || []).map((p) => [p.id, p.stock_count]));

    for (const item of items) {
      if (!stockMap.has(item.id)) {
        throw new Error(`Could not verify stock for ${item.name}`);
      }
      const stockCount = stockMap.get(item.id) ?? 0;
      if (stockCount < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Only ${stockCount} available.`);
      }
    }
  };

  const sendOwnerNotification = async (confirmedOrderId: string) => {
    try {
      await supabase.functions.invoke('send-order-notification', {
        body: {
          order_id: confirmedOrderId,
          customer_name: shippingName || profile?.full_name || 'Customer',
          order_total: finalTotal,
        },
      });
    } catch (error) {
      console.error('Failed to send owner notification:', error);
    }
  };

  const handlePlaceOrder = async () => {
    const validationError = validate();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    if (!usingSavedCard) {
      const cardElement = elements?.getElement(CardElement);
      if (!cardElement) {
        showToast('Enter card details to continue.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      await checkStock();

      const { data: paymentIntentData, error: paymentIntentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: toCents(finalTotal),
          currency: 'gbp',
          customer_id: profile?.stripe_customer_id || undefined,
          payment_method_id: usingSavedCard ? selectedPm : undefined,
          description: `Shop Order: ${items.length} item(s) + shipping to ${getCountryName(shippingCountry)}`,
          capture_method: 'automatic',
        },
      });

      if (paymentIntentError) throw paymentIntentError;
      const clientSecret = paymentIntentData?.clientSecret as string | undefined;
      const paymentIntentId = paymentIntentData?.paymentIntentId as string | undefined;
      if (!clientSecret || !paymentIntentId) throw new Error('Stripe payment setup failed.');

      const paymentResult = usingSavedCard
        ? await stripe!.confirmCardPayment(clientSecret, { payment_method: selectedPm })
        : await stripe!.confirmCardPayment(clientSecret, {
            payment_method: {
              card: elements!.getElement(CardElement)!,
              billing_details: {
                name: shippingName.trim(),
                email: profile?.email || user?.email || undefined,
                phone: shippingPhone.trim(),
                address: {
                  line1: shippingAddress.trim(),
                  city: shippingCity.trim(),
                  postal_code: shippingPostalCode.trim(),
                  country: shippingCountry,
                },
              },
            },
          });

      if (paymentResult.error) throw new Error(paymentResult.error.message || 'Payment failed.');
      if (paymentResult.paymentIntent?.status !== 'succeeded') throw new Error('Payment was not completed.');

      const { data: finalizedOrder, error: finalizeError } = await supabase.functions.invoke('finalize-shop-order', {
        body: {
          items: items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
          payment_intent_id: paymentIntentId,
          currency: 'gbp',
          shipping: {
            name: shippingName.trim(),
            phone: shippingPhone.trim(),
            address: shippingAddress.trim(),
            city: shippingCity.trim(),
            postal_code: shippingPostalCode.trim(),
            country: shippingCountry,
            notes: notes.trim() || null,
          },
        },
      });

      if (finalizeError) throw finalizeError;
      const finalizedOrderId = finalizedOrder?.order_id as string | undefined;
      const alreadyFinalized = finalizedOrder?.already_finalized === true;
      if (!finalizedOrderId) throw new Error('Order finalization failed.');

      if (!alreadyFinalized) {
        await sendOwnerNotification(finalizedOrderId);
      }
      clearCart();
      setOrderId(finalizedOrderId);
      showToast('Order placed successfully!', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderId) {
    return (
      <div className="glass-card p-12 text-center max-w-2xl mx-auto">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
          <CheckCircle2 size={48} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Order Confirmed</h1>
        <p className="text-[var(--color-text-secondary)] mb-2">Your order #{orderId.slice(0, 8).toUpperCase()} has been placed.</p>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">We’ll prepare your package and update shipping soon.</p>
        <button onClick={() => router.push('/dashboard/shop')} className="btn-pink px-8 py-3 text-sm">
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_390px] gap-6 items-start">
      <div className="space-y-6">
        <section className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center">
              <MapPin size={20} className="text-[var(--color-brand-pink-dark)]" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--color-text-primary)]">Shipping Details</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Europe-wide delivery</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-upper">Full Name *</label>
              <input value={shippingName} onChange={(event) => setShippingName(event.target.value)} className="input-glass w-full" placeholder="Recipient name" />
            </div>
            <div>
              <label className="label-upper">Phone *</label>
              <input value={shippingPhone} onChange={(event) => setShippingPhone(event.target.value)} className="input-glass w-full" placeholder="Delivery phone" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-upper">Address *</label>
              <input value={shippingAddress} onChange={(event) => setShippingAddress(event.target.value)} className="input-glass w-full" placeholder="Street address" />
            </div>
            <div>
              <label className="label-upper">City *</label>
              <input value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} className="input-glass w-full" placeholder="City" />
            </div>
            <div>
              <label className="label-upper">Postal Code *</label>
              <input value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.target.value)} className="input-glass w-full" placeholder="Postal code" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-upper">Country *</label>
              <select value={shippingCountry} onChange={(event) => setShippingCountry(event.target.value)} className="input-glass w-full">
                {EUROPEAN_COUNTRIES_SORTED.map((country) => (
                  <option key={country.code} value={country.code}>{country.name} — £{country.shippingCost.toFixed(2)}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-upper">Order Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="input-glass w-full resize-none" rows={3} placeholder="Delivery notes, preferences, or gift message" />
            </div>
          </div>
        </section>

        <section className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-200 to-cyan-200 flex items-center justify-center">
              <CreditCard size={20} className="text-sky-600" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--color-text-primary)]">Payment</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Secure payment powered by Stripe</p>
            </div>
          </div>

          {!stripePublishableKey && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in environment variables.
            </div>
          )}

          {loadingCards ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-4">
              <Loader2 size={16} className="animate-spin" /> Loading payment methods...
            </div>
          ) : savedCards.length > 0 ? (
            <div className="space-y-2 mb-4">
              {savedCards.map(card => (
                <label
                  key={card.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedPm === card.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20'
                      : 'border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30'
                  }`}
                >
                  <input type="radio" name="checkout_pm" value={card.id} checked={selectedPm === card.id} onChange={() => setSelectedPm(card.id)} className="accent-[var(--color-primary)]" />
                  <CardBrandBadge brand={card.brand} />
                  <span className="font-semibold text-sm text-[var(--color-text-primary)]">•••• {card.last4}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{String(card.expMonth).padStart(2, '0')}/{card.expYear}</span>
                  {card.isDefault && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-auto">Default</span>}
                </label>
              ))}
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedPm === 'new'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20'
                    : 'border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30'
                }`}
              >
                <input type="radio" name="checkout_pm" value="new" checked={selectedPm === 'new'} onChange={() => setSelectedPm('new')} className="accent-[var(--color-primary)]" />
                <Plus size={16} className="text-[var(--color-text-muted)]" />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Use a new card</span>
              </label>
            </div>
          ) : null}

          {(!usingSavedCard || savedCards.length === 0) && (
            <div className="input-glass w-full py-4">
              <CardElement options={cardOptions} />
            </div>
          )}
        </section>
      </div>

      <aside className="glass-card p-6 sticky top-24">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center">
            <Package size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-[var(--color-text-primary)]">Review Order</h2>
            <p className="text-xs text-[var(--color-text-muted)]">{items.length} product{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="space-y-3 mb-5 max-h-80 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--color-surface-light)] shrink-0">
                <img src={item.image_url || fallbackImage} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-1">{item.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Qty {item.quantity}</p>
              </div>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">£{(item.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 text-sm mb-6 border-t border-[var(--color-border-light)] pt-4">
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Subtotal</span>
            <span>£{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-secondary)]">
            <span>Shipping to {getCountryName(shippingCountry)}</span>
            <span>£{shippingCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-xl text-[var(--color-text-primary)] border-t border-[var(--color-border-light)] pt-3">
            <span>Total</span>
            <span>£{finalTotal.toFixed(2)}</span>
          </div>
        </div>

        <button onClick={handlePlaceOrder} disabled={submitting || !stripe || items.length === 0 || (!usingSavedCard && !elements)} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Pay & Place Order'}
        </button>
        <Link href="/dashboard/cart" className="btn-outline w-full py-3 text-sm flex items-center justify-center gap-2 mt-3">
          <ArrowLeft size={16} /> Back to Cart
        </Link>
      </aside>
    </div>
  );
}

export default function CheckoutPage() {
  const { items } = useCart();

  if (items.length === 0) {
    return (
      <div className="animate-fade-in max-w-2xl mx-auto">
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag size={34} className="text-[var(--color-brand-pink-dark)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">Nothing to checkout</h1>
          <p className="text-[var(--color-text-secondary)] mb-8">Your cart is empty.</p>
          <Link href="/dashboard/shop" className="btn-pink inline-flex px-7 py-3 text-sm">Browse Shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <Link href="/dashboard/cart" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4">
          <ArrowLeft size={16} /> Back to Cart
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--color-brand-pink-dark)] mb-2">Secure Checkout</p>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Complete your order</h1>
      </div>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </div>
  );
}
