'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Plus, Pencil, Trash2, Pause, Play, X, Loader2, Gift,
} from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean | null;
  credit_type: string | null;
  discount_amount: number | null;
  master_id: string | null;
}

type CreditType = 'service' | 'discount_percent' | 'discount_amount';

const REWARD_TYPES: { value: CreditType; label: string; emoji: string }[] = [
  { value: 'service', label: 'Free Service', emoji: '🎁' },
  { value: 'discount_percent', label: 'Discount %', emoji: '💵' },
  { value: 'discount_amount', label: 'Fixed Amount Off', emoji: '💰' },
];

function describeReward(r: Reward) {
  switch (r.credit_type) {
    case 'service':
    case 'free_service':
      return 'Free Service';
    case 'discount_percent':
      return r.discount_amount != null ? `${r.discount_amount}% Off` : 'Discount %';
    case 'discount_amount':
    case 'discount':
      return r.discount_amount != null ? `€${r.discount_amount} Off` : 'Fixed Amount Off';
    default:
      return 'Reward';
  }
}

export default function ManageRewardsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const isMasterOrOwner = role === 'master' || role === 'owner';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState('100');
  const [creditType, setCreditType] = useState<CreditType>('service');
  const [discountAmount, setDiscountAmount] = useState('');

  const loadRewards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('master_id', user.id)
        .order('points_cost', { ascending: true });
      if (error) throw error;
      setRewards((data as unknown as Reward[]) || []);
    } catch (err) {
      console.error('[Manage] load error:', err);
      showToast('Failed to load rewards', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, showToast]);

  // Initial fetch + role guard. setState is inherent to async data fetching.
  useEffect(() => {
    if (authLoading) return;
    if (!isMasterOrOwner) {
      router.replace('/dashboard/loyalty');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRewards();
  }, [authLoading, isMasterOrOwner, loadRewards, router]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPointsCost('100');
    setCreditType('service');
    setDiscountAmount('');
    setEditing(null);
  };

  const openEditor = (reward?: Reward) => {
    if (reward) {
      setEditing(reward);
      setName(reward.name);
      setDescription(reward.description || '');
      setPointsCost(reward.points_cost.toString());
      const ct = (reward.credit_type || 'service') as CreditType;
      setCreditType(['service', 'discount_percent', 'discount_amount'].includes(ct) ? ct : 'service');
      setDiscountAmount(reward.discount_amount != null ? reward.discount_amount.toString() : '');
    } else {
      resetForm();
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      showToast('Please enter a reward name', 'error');
      return;
    }
    const cost = parseInt(pointsCost, 10);
    if (!cost || Number.isNaN(cost) || cost <= 0) {
      showToast('Please enter a valid points cost', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        master_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        points_cost: cost,
        credit_type: creditType,
        discount_amount:
          creditType !== 'service' && discountAmount ? parseFloat(discountAmount) : null,
        is_active: true,
      };

      if (editing) {
        const { error } = await supabase
          .from('loyalty_rewards')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        showToast('Reward updated', 'success');
      } else {
        const { error } = await supabase.from('loyalty_rewards').insert(payload);
        if (error) throw error;
        showToast('Reward created', 'success');
      }
      setEditorOpen(false);
      resetForm();
      await loadRewards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save reward', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (reward: Reward) => {
    try {
      const { error } = await supabase
        .from('loyalty_rewards')
        .update({ is_active: !reward.is_active })
        .eq('id', reward.id);
      if (error) throw error;
      await loadRewards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const deleteReward = async (reward: Reward) => {
    if (!confirm(`Delete "${reward.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('loyalty_rewards').delete().eq('id', reward.id);
      if (error) throw error;
      showToast('Reward deleted', 'success');
      await loadRewards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  if (authLoading || !isMasterOrOwner) {
    return (
      <div className="max-w-3xl mx-auto p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/loyalty"
            className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Rewards Library</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Manage rewards for points &amp; stamp cards</p>
          </div>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
        >
          <Plus size={16} /> New Reward
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={28} />
        </div>
      ) : rewards.length === 0 ? (
        <div className="glass-card p-12 text-center border border-dashed border-[var(--color-border-light)]">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-200 to-pink-200 flex items-center justify-center mx-auto mb-4">
            <Gift size={32} className="text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">No rewards yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            Create rewards that clients can redeem with points or earn by completing stamp cards.
          </p>
          <button
            onClick={() => openEditor()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
          >
            <Plus size={14} /> Create First Reward
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className={`glass-card p-5 ${!reward.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-[var(--color-text-primary)]">{reward.name}</h3>
                    {!reward.is_active && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-brand-pink-dark)] font-semibold mt-0.5">
                    {describeReward(reward)}
                  </p>
                  {reward.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">{reward.description}</p>
                  )}
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-100 ml-3 shrink-0">
                  <span className="text-xs font-bold text-amber-700">{reward.points_cost} pts</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border-light)]/60">
                <button
                  onClick={() => openEditor(reward)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => toggleActive(reward)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                >
                  {reward.is_active ? <Pause size={14} /> : <Play size={14} />}
                  {reward.is_active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteReward(reward)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer ml-auto"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => !saving && setEditorOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {editing ? 'Edit Reward' : 'New Reward'}
              </h2>
              <button
                onClick={() => !saving && setEditorOpen(false)}
                disabled={saving}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Reward Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Free Haircut"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Valid for any haircut service"
                  rows={2}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)] resize-none"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Points Cost *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={pointsCost}
                  onChange={(e) => setPointsCost(e.target.value)}
                  placeholder="100"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  How many loyalty points does a client need to redeem this?
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Reward Type
                </label>
                <div className="mt-2 space-y-2">
                  {REWARD_TYPES.map((t) => {
                    const selected = creditType === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => setCreditType(t.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'border-[var(--color-brand-pink)] bg-[var(--color-brand-pink-light)]'
                            : 'border-[var(--color-border-light)] bg-white hover:bg-[var(--color-surface-light)]'
                        }`}
                      >
                        <span className="text-xl">{t.emoji}</span>
                        <span className={`flex-1 text-left text-sm ${selected ? 'font-bold text-[var(--color-brand-pink-dark)]' : 'text-[var(--color-text-secondary)]'}`}>
                          {t.label}
                        </span>
                        {selected && <span className="text-[var(--color-brand-pink-dark)] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {creditType !== 'service' && (
                <div>
                  <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                    {creditType === 'discount_percent' ? 'Discount %' : 'Amount (€)'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder={creditType === 'discount_percent' ? '20' : '10.00'}
                    className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => !saving && setEditorOpen(false)}
                disabled={saving}
                className="flex-1 px-5 py-3 rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-5 py-3 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : editing ? 'Save Changes' : 'Create Reward'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in { animation: scaleIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}
