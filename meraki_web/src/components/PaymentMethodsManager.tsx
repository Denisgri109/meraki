'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, Plus, Trash2, Star, Loader2, X, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

export interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

function getBrandDisplay(brand: string) {
  const brands: Record<string, { label: string; color: string }> = {
    visa: { label: 'Visa', color: 'text-blue-600' },
    mastercard: { label: 'Mastercard', color: 'text-orange-500' },
    amex: { label: 'Amex', color: 'text-blue-500' },
    discover: { label: 'Discover', color: 'text-orange-400' },
    diners: { label: 'Diners', color: 'text-blue-400' },
    jcb: { label: 'JCB', color: 'text-green-600' },
    unionpay: { label: 'UnionPay', color: 'text-red-500' },
  };
  return brands[brand] || { label: brand.charAt(0).toUpperCase() + brand.slice(1), color: 'text-gray-600' };
}

export function CardBrandBadge({ brand }: { brand: string }) {
  const display = getBrandDisplay(brand);
  return (
    <div className="w-12 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
      <span className={`text-xs font-bold ${display.color}`}>{display.label}</span>
    </div>
  );
}

function PaymentMethodsManagerInner() {
  const stripe = useStripe();
  const elements = useElements();
  const supabase = createClient();
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('list-payment-methods', {
        body: {},
      });
      if (error) throw error;
      setCards(data?.paymentMethods || []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleAddCard = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setAdding(true);
    try {
      const { data: setupData, error: setupError } = await supabase.functions.invoke('setup-intent', {
        body: {
          customer_id: profile?.stripe_customer_id || undefined,
          user_email: profile?.email || undefined,
        },
      });
      if (setupError) throw setupError;

      const { setupIntent, error: confirmError } = await stripe.confirmCardSetup(
        setupData.clientSecret,
        { payment_method: { card: cardElement } }
      );
      if (confirmError) throw new Error(confirmError.message);

      if (cards.length === 0 && setupIntent?.payment_method) {
        await supabase.functions.invoke('set-default-payment-method', {
          body: { payment_method_id: setupIntent.payment_method },
        });
      }

      if (!profile?.stripe_customer_id) {
        await refreshProfile();
      }

      showToast('Card added successfully', 'success');
      setShowAddForm(false);
      cardElement.clear();
      await loadCards();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add card';
      showToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleSetDefault = async (pmId: string) => {
    setSettingDefault(pmId);
    try {
      const { error } = await supabase.functions.invoke('set-default-payment-method', {
        body: { payment_method_id: pmId },
      });
      if (error) throw error;
      setCards(prev => prev.map(c => ({ ...c, isDefault: c.id === pmId })));
      showToast('Default card updated', 'success');
    } catch {
      showToast('Failed to set default card', 'error');
    } finally {
      setSettingDefault(null);
    }
  };

  const handleDelete = async (pmId: string) => {
    if (!confirm('Remove this card? This cannot be undone.')) return;
    setDeletingCard(pmId);
    try {
      const { error } = await supabase.functions.invoke('delete-payment-method', {
        body: { payment_method_id: pmId },
      });
      if (error) throw error;
      showToast('Card removed', 'success');
      await loadCards();
    } catch {
      showToast('Failed to remove card', 'error');
    } finally {
      setDeletingCard(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cards.length === 0 && !showAddForm ? (
        <div className="text-center py-8">
          <CreditCard size={36} className="mx-auto text-[var(--color-text-muted)] mb-3" />
          <p className="font-medium text-[var(--color-text-secondary)] mb-1">No saved cards</p>
          <p className="text-xs text-[var(--color-text-muted)]">Add a payment method to speed up future bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => {
            const brand = getBrandDisplay(card.brand);
            return (
              <div
                key={card.id}
                className="flex items-center gap-4 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] group"
              >
                <div className="w-12 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <span className={`text-xs font-bold ${brand.color}`}>{brand.label}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                      •••• {card.last4}
                    </span>
                    {card.isDefault && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!card.isDefault && (
                    <button
                      onClick={() => handleSetDefault(card.id)}
                      disabled={settingDefault === card.id}
                      className="p-2 rounded-lg hover:bg-amber-50 text-[var(--color-text-muted)] hover:text-amber-600 transition-colors cursor-pointer disabled:opacity-50"
                      title="Set as default"
                    >
                      {settingDefault === card.id ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(card.id)}
                    disabled={deletingCard === card.id}
                    className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove card"
                  >
                    {deletingCard === card.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm ? (
        <div className="p-5 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-sm text-[var(--color-text-primary)] flex items-center gap-2">
              <CreditCard size={16} /> Add New Card
            </h4>
            <button
              onClick={() => setShowAddForm(false)}
              disabled={adding}
              className="p-1.5 rounded-full hover:bg-black/5 cursor-pointer"
            >
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>
          <div className="p-4 bg-white rounded-lg border border-[var(--color-border-light)] shadow-inner mb-4">
            <CardElement options={{
              style: {
                base: { fontSize: '16px', color: '#1A1A1A', '::placeholder': { color: '#9CA3AF' } },
                invalid: { color: '#EF4444' },
              },
            }} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddCard}
              disabled={adding || !stripe}
              className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {adding ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Card'}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Shield size={12} /> Secured by Stripe · 3D Secure supported
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full p-3 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-light)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> Add Payment Method
        </button>
      )}
    </div>
  );
}

export default function PaymentMethodsManager() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentMethodsManagerInner />
    </Elements>
  );
}
