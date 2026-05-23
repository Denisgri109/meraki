'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Plus, Pencil, Trash2, Pause, Play, X, Loader2, Ticket, Star, Save,
} from 'lucide-react';

interface LoyaltyCard {
  id: string;
  master_id: string;
  name: string;
  description: string | null;
  stamps_required: number;
  reward_type: string;
  reward_value: number | null;
  is_active: boolean | null;
  created_at: string | null;
}

type RewardType = 'free_service' | 'discount_percent' | 'discount_amount';

const REWARD_TYPES: { value: RewardType; label: string; emoji: string }[] = [
  { value: 'free_service', label: 'Free Service', emoji: '🎁' },
  { value: 'discount_percent', label: 'Discount %', emoji: '💵' },
  { value: 'discount_amount', label: 'Fixed Amount Off', emoji: '💰' },
];

const STAMP_PRESETS = [3, 5, 6, 8, 10, 12];

function describeReward(c: LoyaltyCard) {
  switch (c.reward_type) {
    case 'free_service':
      return 'Free Service';
    case 'discount_percent':
      return c.reward_value != null ? `${c.reward_value}% Off` : 'Discount %';
    case 'discount_amount':
      return c.reward_value != null ? `\u20AC${c.reward_value} Off` : 'Fixed Amount Off';
    default:
      return 'Reward';
  }
}

export default function LoyaltyCardsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const isMasterOrOwner = role === 'master' || role === 'owner';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LoyaltyCard | null>(null);

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stampsRequired, setStampsRequired] = useState('6');
  const [rewardType, setRewardType] = useState<RewardType>('free_service');
  const [rewardValue, setRewardValue] = useState('');

  const loadCards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('master_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCards((data as unknown as LoyaltyCard[]) || []);
    } catch (err) {
      console.error('[LoyaltyCards] load error:', err);
      showToast('Failed to load loyalty cards', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, showToast]);

  useEffect(() => {
    if (authLoading) return;
    if (!isMasterOrOwner) {
      router.replace('/dashboard/loyalty');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCards();
  }, [authLoading, isMasterOrOwner, loadCards, router]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setStampsRequired('6');
    setRewardType('free_service');
    setRewardValue('');
    setEditing(null);
  };

  const openEditor = (card?: LoyaltyCard) => {
    if (card) {
      setEditing(card);
      setName(card.name);
      setDescription(card.description || '');
      setStampsRequired(String(card.stamps_required));
      const rt = (card.reward_type || 'free_service') as RewardType;
      setRewardType(['free_service', 'discount_percent', 'discount_amount'].includes(rt) ? rt : 'free_service');
      setRewardValue(card.reward_value != null ? String(card.reward_value) : '');
    } else {
      resetForm();
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      showToast('Please enter a card name', 'error');
      return;
    }
    const stamps = parseInt(stampsRequired, 10);
    if (!Number.isFinite(stamps) || stamps < 1 || stamps > 50) {
      showToast('Stamps required must be 1\u201350', 'error');
      return;
    }
    if (rewardType !== 'free_service') {
      const v = parseFloat(rewardValue);
      if (!Number.isFinite(v) || v <= 0) {
        showToast('Please enter a valid reward value', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        master_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        stamps_required: stamps,
        reward_type: rewardType,
        reward_value: rewardType === 'free_service' ? null : parseFloat(rewardValue),
        is_active: true,
      };

      if (editing) {
        const { error } = await supabase.from('loyalty_cards').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Loyalty card updated', 'success');
      } else {
        const { error } = await supabase.from('loyalty_cards').insert(payload);
        if (error) throw error;
        showToast('Loyalty card created', 'success');
      }
      setEditorOpen(false);
      resetForm();
      await loadCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save card', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (card: LoyaltyCard) => {
    try {
      const { error } = await supabase
        .from('loyalty_cards')
        .update({ is_active: !card.is_active })
        .eq('id', card.id);
      if (error) throw error;
      await loadCards();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const deleteCard = async (card: LoyaltyCard) => {
    if (!confirm(`Delete "${card.name}"? Existing client progress on this card will be lost.`)) return;
    try {
      const { error } = await supabase.from('loyalty_cards').delete().eq('id', card.id);
      if (error) throw error;
      showToast('Loyalty card deleted', 'success');
      await loadCards();
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
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Loyalty Cards</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Build stamp cards your clients can collect</p>
          </div>
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
        >
          <Plus size={16} /> New card
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={28} />
        </div>
      ) : cards.length === 0 ? (
        <div className="glass-card p-12 text-center border border-dashed border-[var(--color-border-light)]">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-200 to-pink-200 flex items-center justify-center mx-auto mb-4">
            <Ticket size={32} className="text-violet-500" />
          </div>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">No loyalty cards yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            Create stamp cards that reward your clients for repeat visits.
            You can have multiple cards (e.g. one per service category).
          </p>
          <button
            onClick={() => openEditor()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
          >
            <Plus size={14} /> Create first card
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <div key={card.id} data-row-id={card.id} className={`glass-card p-5 ${!card.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center shadow-md shrink-0">
                    <Ticket size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[var(--color-text-primary)]">{card.name}</h3>
                      {!card.is_active && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                          Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-brand-pink-dark)] font-semibold mt-0.5">
                      {card.stamps_required} stamps → {describeReward(card)}
                    </p>
                    {card.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{card.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Stamp slots preview */}
              <div className="bg-[var(--color-surface-light)] rounded-xl p-3 mb-3">
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: card.stamps_required }).map((_, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-lg bg-white/80 border border-black/5 flex items-center justify-center"
                    >
                      <Star size={12} className="text-black/15" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border-light)]/60">
                <button
                  onClick={() => openEditor(card)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => toggleActive(card)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                >
                  {card.is_active ? <Pause size={14} /> : <Play size={14} />}
                  {card.is_active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteCard(card)}
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
                {editing ? 'Edit loyalty card' : 'New loyalty card'}
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
                  Card name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Brow Loyalty"
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Clients see this when picking which card to stamp.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Eligible after every brow service"
                  rows={2}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)] resize-none"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Stamps required *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={stampsRequired}
                  onChange={(e) => setStampsRequired(e.target.value)}
                  className="w-full mt-2 px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {STAMP_PRESETS.map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setStampsRequired(String(v))}
                      className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                        stampsRequired === String(v)
                          ? 'bg-[var(--color-brand-pink)] text-white'
                          : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-pink-light)]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                  Reward
                </label>
                <div className="mt-2 space-y-2">
                  {REWARD_TYPES.map((t) => {
                    const selected = rewardType === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => setRewardType(t.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          selected
                            ? 'border-[var(--color-brand-pink)] bg-[var(--color-brand-pink-light)]'
                            : 'border-[var(--color-border-light)] bg-white hover:bg-[var(--color-surface-light)]'
                        }`}
                      >
                        <span className="text-xl">{t.emoji}</span>
                        <span
                          className={`flex-1 text-left text-sm ${
                            selected ? 'font-bold text-[var(--color-brand-pink-dark)]' : 'text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {t.label}
                        </span>
                        {selected && <span className="text-[var(--color-brand-pink-dark)] font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {rewardType !== 'free_service' && (
                <div>
                  <label className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                    {rewardType === 'discount_percent' ? 'Discount %' : 'Amount (\u20AC)'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={rewardValue}
                    onChange={(e) => setRewardValue(e.target.value)}
                    placeholder={rewardType === 'discount_percent' ? '20' : '10.00'}
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
                className="flex-1 flex items-center justify-center gap-1.5 px-5 py-3 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : (
                  <>
                    <Save size={14} />
                    {editing ? 'Save changes' : 'Create card'}
                  </>
                )}
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
