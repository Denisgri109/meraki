'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  Gift, Star, Trophy, Sparkles, QrCode, Crown, Zap, Award, X, Loader2,
  History, Clock, Ticket, Settings, Plus, Camera, Layers,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  credit_type?: string | null;
  discount_amount?: number | null;
  master_id?: string | null;
}

interface LoyaltyTransaction {
  id: string;
  description: string | null;
  type: string;
  points: number;
  created_at: string | null;
}

interface StampCard {
  stamp_id: string;
  card_id: string;
  card_name: string;
  card_description: string | null;
  master_id: string;
  master_name: string;
  master_avatar: string | null;
  stamps_collected: number;
  stamps_required: number;
  stamps_redeemed: number;
  reward_type: string;
  reward_value: number | null;
  reward_available: boolean;
  last_stamp_at: string | null;
}

interface UserCredit {
  id: string;
  credit_type: string;
  amount: number;
  description: string | null;
  is_used: boolean | null;
  expires_at: string | null;
  created_at: string | null;
}

const TIERS = [
  { name: 'Bronze', min: 0, gradient: 'from-amber-600 to-amber-400', icon: Star, emoji: '🥉' },
  { name: 'Silver', min: 500, gradient: 'from-gray-400 to-gray-300', icon: Crown, emoji: '🥈' },
  { name: 'Gold', min: 1500, gradient: 'from-yellow-500 to-amber-300', icon: Sparkles, emoji: '🥇' },
];

function formatRewardValue(credit: UserCredit) {
  if (credit.credit_type === 'discount' || credit.credit_type === 'discount_amount') {
    return `€${credit.amount} Off`;
  }
  if (credit.credit_type === 'discount_percent') {
    return `${credit.amount}% Off`;
  }
  return credit.description || 'Reward';
}

function rewardTypeLabel(reward: LoyaltyReward) {
  switch (reward.credit_type) {
    case 'service':
    case 'free_service':
      return 'Free Service';
    case 'discount_percent':
      return reward.discount_amount ? `${reward.discount_amount}% Off` : 'Discount %';
    case 'discount_amount':
    case 'discount':
      return reward.discount_amount ? `€${reward.discount_amount} Off` : 'Fixed Amount Off';
    default:
      return null;
  }
}

function partitionCredits(credits: UserCredit[]) {
  const now = Date.now();
  const active: UserCredit[] = [];
  const expired: UserCredit[] = [];
  for (const c of credits) {
    const isExpired = c.is_used || (c.expires_at != null && new Date(c.expires_at).getTime() <= now);
    if (isExpired) expired.push(c);
    else active.push(c);
  }
  return { activeCredits: active, expiredCredits: expired };
}

function stampCardRewardText(card: StampCard) {
  switch (card.reward_type) {
    case 'free_service':
      return 'Free Service';
    case 'discount_percent':
      return `${card.reward_value ?? ''}% Off`;
    case 'discount_amount':
      return `€${card.reward_value ?? ''} Off`;
    default:
      return 'Reward';
  }
}

export default function LoyaltyPage() {
  const { user, profile, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const isMasterOrOwner = role === 'master' || role === 'owner';

  // Shared
  const [loading, setLoading] = useState(true);

  // Client state
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [stampCards, setStampCards] = useState<StampCard[]>([]);
  const [userCredits, setUserCredits] = useState<UserCredit[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [activeCreditsTab, setActiveCreditsTab] = useState<'active' | 'expired'>('active');
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Master/Owner state
  const [stampsToday, setStampsToday] = useState(0);
  const [myRewards, setMyRewards] = useState<LoyaltyReward[]>([]);


  // ── Fetch data based on role ───────────────────────────────────────────
  const fetchClientData = useCallback(async () => {
    if (!user) return;
    try {
      // Points from profile
      if (profile) {
        setPoints(((profile as unknown as { loyalty_points?: number })?.loyalty_points) || 0);
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('loyalty_points')
          .eq('id', user.id)
          .single();
        setPoints(((data as unknown as { loyalty_points?: number })?.loyalty_points) || 0);
      }

      // Available rewards
      const { data: rewardsData } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_cost', { ascending: true });
      setRewards((rewardsData as unknown as LoyaltyReward[]) || []);

      // Stamp cards
      const { data: cardsData, error: cardsError } = await supabase.rpc('get_client_stamp_cards', {
        p_client_id: user.id,
      });
      if (cardsError) console.error('[Loyalty] stamp cards error:', cardsError);
      setStampCards((cardsData as unknown as StampCard[]) || []);

      // User credits
      const { data: creditsData } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setUserCredits((creditsData as unknown as UserCredit[]) || []);

      // Transactions
      const { data: txData } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setTransactions((txData as unknown as LoyaltyTransaction[]) || []);
    } catch (err) {
      console.error('[Loyalty] client fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profile, supabase]);

  const fetchMasterData = useCallback(async () => {
    if (!user) return;
    try {
      // Master's own rewards
      const { data: rewardsData } = await supabase
        .from('loyalty_rewards')
        .select('*')
        .eq('master_id', user.id)
        .order('points_cost', { ascending: true });
      setMyRewards((rewardsData as unknown as LoyaltyReward[]) || []);

      // Stamps given today: count stamp_history rows where related client_stamp.master_id = user.id and action='earned' since midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: stamps, error: stampsErr } = await supabase
        .from('stamp_history')
        .select('id, client_stamps!inner(master_id)')
        .eq('action', 'earned')
        .eq('client_stamps.master_id', user.id)
        .gte('created_at', today.toISOString());
      if (stampsErr) console.error('[Loyalty] stamps today error:', stampsErr);
      setStampsToday((stamps as unknown as unknown[])?.length || 0);
    } catch (err) {
      console.error('[Loyalty] master fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Initial fetch on mount + role change. setState is inherent to async data fetching.
  useEffect(() => {
    if (!user) return;
    if (isMasterOrOwner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchMasterData();
    } else {
      void fetchClientData();
    }
  }, [user, isMasterOrOwner, fetchClientData, fetchMasterData]);

  // ── Client actions ─────────────────────────────────────────────────────
  const handleRedeem = async (reward: LoyaltyReward) => {
    if (!user) return;
    if (points < reward.points_cost) {
      showToast('Not enough points', 'error');
      return;
    }
    if (!confirm(`Redeem "${reward.name}" for ${reward.points_cost} points?`)) return;
    setRedeeming(reward.id);
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_reward_id: reward.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result && result.success === false) {
        showToast(result.message || 'Failed to redeem', 'error');
      } else {
        showToast(`"${reward.name}" redeemed!`, 'success');
        fetchClientData();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Redemption failed', 'error');
    } finally {
      setRedeeming(null);
    }
  };

  const handleRedeemStampCard = async (card: StampCard) => {
    if (!user || !card.reward_available) return;
    if (!confirm(`Redeem your reward from ${card.master_name}?`)) return;
    try {
      const { data, error } = await supabase.rpc('redeem_stamp_card', {
        p_client_stamp_id: card.stamp_id,
        p_client_id: user.id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; message?: string } | null;
      if (result?.success) {
        showToast(result.message || 'Reward redeemed!', 'success');
        fetchClientData();
      } else {
        showToast(result?.message || 'Failed to redeem', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to redeem', 'error');
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────
  const currentTier = TIERS.reduce((acc, t) => (points >= t.min ? t : acc), TIERS[0]);
  const nextTier = TIERS.find((t) => t.min > points);
  const progressToNext = nextTier
    ? Math.min(((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100, 100)
    : 100;

  const { activeCredits, expiredCredits } = useMemo(
    () => partitionCredits(userCredits),
    [userCredits],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* ─── Hero Banner ─── */}
      <div className="relative rounded-[var(--radius-2xl)] overflow-hidden mb-10 h-[220px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1600&q=80&auto=format&fit=crop"
          alt="Rewards"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={18} className="text-amber-300" />
            <span className="text-xs tracking-[0.2em] uppercase text-amber-300 font-bold">Rewards</span>
          </div>
          <h1 className="text-4xl font-bold drop-shadow-lg">
            {isMasterOrOwner ? 'Reward Your Clients' : 'Earn & Redeem'}
          </h1>
          <p className="text-white/80 text-sm mt-2 max-w-md">
            {isMasterOrOwner
              ? 'Show your QR for clients to collect stamps and manage your reward catalog'
              : 'Collect stamps and points with every visit and unlock exclusive rewards'}
          </p>
        </div>
      </div>

      {isMasterOrOwner ? (
        <MasterView
          stampsToday={stampsToday}
          myRewards={myRewards}
        />
      ) : (
        <ClientView
          points={points}
          currentTier={currentTier}
          nextTier={nextTier}
          progressToNext={progressToNext}
          stampCards={stampCards}
          activeCreditsTab={activeCreditsTab}
          setActiveCreditsTab={setActiveCreditsTab}
          activeCredits={activeCredits}
          expiredCredits={expiredCredits}
          rewards={rewards}
          redeeming={redeeming}
          onRedeem={handleRedeem}
          onRedeemStampCard={handleRedeemStampCard}
          onShowHistory={() => setShowHistory(true)}
        />
      )}

      {/* History Modal (client) */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowHistory(false)}
        >
          <div
            className="p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto animate-scale-in rounded-2xl shadow-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <History size={20} /> Points History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" />
                <p className="text-sm text-[var(--color-text-muted)]">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {tx.description || tx.type}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        tx.points > 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {tx.points > 0 ? '+' : ''}
                      {tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

// ─── Client View ───────────────────────────────────────────────────────────
function ClientView({
  points,
  currentTier,
  nextTier,
  progressToNext,
  stampCards,
  activeCreditsTab,
  setActiveCreditsTab,
  activeCredits,
  expiredCredits,
  rewards,
  redeeming,
  onRedeem,
  onRedeemStampCard,
  onShowHistory,
}: {
  points: number;
  currentTier: typeof TIERS[number];
  nextTier: typeof TIERS[number] | undefined;
  progressToNext: number;
  stampCards: StampCard[];
  activeCreditsTab: 'active' | 'expired';
  setActiveCreditsTab: (t: 'active' | 'expired') => void;
  activeCredits: UserCredit[];
  expiredCredits: UserCredit[];
  rewards: LoyaltyReward[];
  redeeming: string | null;
  onRedeem: (r: LoyaltyReward) => void;
  onRedeemStampCard: (c: StampCard) => void;
  onShowHistory: () => void;
}) {
  const displayedCredits = activeCreditsTab === 'active' ? activeCredits : expiredCredits;

  return (
    <>
      {/* Points + Tier Card */}
      <div className="rounded-[var(--radius-2xl)] p-8 mb-8 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl">
        <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-bl from-pink-500/20 to-transparent rounded-full -mr-16 -mt-16" />
        <div className="absolute left-1/2 bottom-0 w-32 h-32 bg-gradient-to-t from-purple-500/15 to-transparent rounded-full -mb-12" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-1">Your Points</p>
              <p className="text-6xl font-bold">{points.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-lg">{currentTier.emoji}</span>
                <span className="text-sm font-semibold text-amber-300">{currentTier.name} Member</span>
              </div>
            </div>
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center shadow-lg animate-float">
              <Trophy size={36} className="text-white" />
            </div>
          </div>

          {nextTier && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-white/50 mb-2">
                <span>{currentTier.name}</span>
                <span>{nextTier.name} — {nextTier.min - points} pts to go</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-400 transition-all duration-1000 ease-out"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/loyalty/scan"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 text-sm font-bold hover:bg-gray-100 hover:scale-105 transition-all cursor-pointer shadow-lg"
            >
              <Camera size={14} /> Scan to earn
            </Link>
            <button
              onClick={onShowHistory}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer backdrop-blur-sm"
            >
              <History size={14} /> History
            </button>
          </div>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {TIERS.map((tier, idx) => {
          const isActive = points >= tier.min;
          const Icon = tier.icon;
          return (
            <div
              key={tier.name}
              className={`glass-card p-5 text-center transition-all duration-300 hover:-translate-y-1 ${
                isActive ? 'shadow-lg' : 'opacity-60'
              }`}
            >
              <div
                className={`w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${tier.gradient} flex items-center justify-center shadow-md ${
                  isActive ? 'animate-float' : ''
                }`}
                style={{ animationDelay: `${idx * 0.3}s` }}
              >
                <Icon size={24} className="text-white" />
              </div>
              <p className="font-bold text-sm text-[var(--color-text-primary)]">{tier.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{tier.min}+ pts</p>
              {isActive && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-600">
                  ✓ Unlocked
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stamp Cards Section */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center">
          <Ticket size={14} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Stamp Cards</h2>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Collect stamps at every visit on the mobile app and unlock rewards from your favourite masters.
      </p>

      {stampCards.length === 0 ? (
        <div className="glass-card p-8 text-center mb-10 border border-dashed border-[var(--color-border-light)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-light)] flex items-center justify-center mx-auto mb-3">
            <Ticket size={24} className="text-[var(--color-text-muted)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No active stamp cards</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Use the mobile app to scan a master&apos;s QR code at the salon to start your first card.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mb-10">
          {stampCards.map((card) => (
            <div key={card.stamp_id} className="glass-card p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-violet-300 to-pink-300 flex items-center justify-center text-white font-bold shrink-0">
                  {card.master_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.master_avatar} alt={card.master_name} className="w-full h-full object-cover" />
                  ) : (
                    card.master_name?.charAt(0) || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--color-text-primary)] truncate">{card.master_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">{card.card_name}</p>
                </div>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    card.reward_available
                      ? 'bg-gradient-to-br from-amber-400 to-pink-400'
                      : 'bg-[var(--color-surface-light)]'
                  }`}
                >
                  <Gift size={16} className={card.reward_available ? 'text-white' : 'text-[var(--color-text-muted)]'} />
                </div>
              </div>

              {/* Slots */}
              <div className="bg-[var(--color-surface-light)] rounded-2xl p-3 mb-4">
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: card.stamps_required }).map((_, i) => {
                    const collected = i < card.stamps_collected;
                    return (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                          collected
                            ? 'bg-gradient-to-br from-amber-400 to-pink-400 border-transparent shadow-sm'
                            : 'bg-white/40 border-black/5'
                        }`}
                      >
                        <Star size={14} className={collected ? 'text-white' : 'text-black/10'} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-[var(--color-text-secondary)] font-semibold">
                    {card.stamps_collected} of {card.stamps_required} collected
                  </span>
                  {card.stamps_redeemed > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-brand-pink-light)] text-[var(--color-brand-pink-dark)] font-bold">
                      {card.stamps_redeemed} redeemed
                    </span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-light)]/60">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Reward</p>
                  <p className="font-bold text-[var(--color-text-primary)]">{stampCardRewardText(card)}</p>
                </div>
                {card.reward_available ? (
                  <button
                    onClick={() => onRedeemStampCard(card)}
                    className="btn-pink px-5 py-2 rounded-full text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
                  >
                    Redeem Now
                  </button>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-light)] px-3 py-1.5 rounded-lg">
                    {card.last_stamp_at
                      ? `Last: ${new Date(card.last_stamp_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : 'No stamps yet'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Rewards (user credits) with tabs */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center">
          <Award size={14} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">My Rewards</h2>
      </div>

      <div className="flex p-1 mb-4 rounded-xl bg-[var(--color-surface-light)]">
        {(['active', 'expired'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveCreditsTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              activeCreditsTab === t
                ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t === 'active' ? 'Active' : 'History'}
          </button>
        ))}
      </div>

      {displayedCredits.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] italic mb-10">
          {activeCreditsTab === 'active'
            ? 'No active rewards yet. Redeem points or complete stamp cards to earn rewards!'
            : 'No expired or used rewards.'}
        </p>
      ) : (
        <div className="space-y-3 mb-10">
          {displayedCredits.map((credit) => {
            const isExpired = activeCreditsTab === 'expired';
            return (
              <div
                key={credit.id}
                className={`glass-card p-5 ${isExpired ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Gift size={20} className={isExpired ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-brand-pink-dark)]'} />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isExpired
                        ? 'bg-[var(--color-surface-light)] text-[var(--color-text-muted)]'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {isExpired ? (credit.is_used ? 'Used' : 'Expired') : 'Active'}
                  </span>
                </div>
                <p className="text-lg font-bold text-[var(--color-brand-pink-dark)] mb-1">{formatRewardValue(credit)}</p>
                {credit.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">{credit.description}</p>
                )}
                {credit.expires_at && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {isExpired ? (credit.is_used ? 'Used' : 'Expired') : 'Expires'}{' '}
                    {new Date(credit.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Available Rewards catalog */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Available Rewards</h2>
      </div>

      {rewards.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center mx-auto mb-3">
            <Zap size={28} className="text-amber-500" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">No rewards available yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Keep visiting to unlock exclusive rewards!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((reward) => {
            const canRedeem = points >= reward.points_cost;
            return (
              <div key={reward.id} className="glass-card p-5 flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0 ${
                    canRedeem ? 'bg-gradient-to-br from-amber-400 to-pink-400' : 'bg-gray-100'
                  }`}
                >
                  <Gift size={24} className={canRedeem ? 'text-white' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[var(--color-text-primary)] truncate">{reward.name}</h3>
                  {rewardTypeLabel(reward) && (
                    <p className="text-xs text-[var(--color-brand-pink-dark)] font-semibold">{rewardTypeLabel(reward)}</p>
                  )}
                  {reward.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">{reward.description}</p>
                  )}
                  <p className="text-xs text-amber-500 font-bold mt-1">{reward.points_cost} points</p>
                </div>
                <button
                  onClick={() => onRedeem(reward)}
                  disabled={!canRedeem || redeeming === reward.id}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all shrink-0 cursor-pointer ${
                    canRedeem ? 'btn-pink hover:scale-105' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {redeeming === reward.id ? <Loader2 size={14} className="animate-spin" /> : canRedeem ? 'Redeem' : 'Locked'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Master / Owner View ────────────────────────────────────────
function MasterView({
  stampsToday,
  myRewards,
}: {
  stampsToday: number;
  myRewards: LoyaltyReward[];
}) {
  return (
    <>
      {/* QR + Stats Card */}
      <div className="rounded-[var(--radius-2xl)] p-8 mb-8 relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl">
        <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-bl from-pink-500/20 to-transparent rounded-full -mr-16 -mt-16" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div>
            <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-1">Stamps Given Today</p>
            <p className="text-6xl font-bold">{stampsToday}</p>
            <p className="text-sm text-white/70 mt-1">+1 stamp per appointment</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard/loyalty/qr"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-gray-900 text-sm font-bold hover:bg-gray-100 hover:scale-105 transition-all shadow-lg cursor-pointer"
            >
              <QrCode size={16} />
              Show my QR
            </Link>
            <Link
              href="/dashboard/loyalty/cards"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all backdrop-blur-sm cursor-pointer"
            >
              <Layers size={14} />
              Loyalty cards
            </Link>
          </div>
        </div>
      </div>

      {/* Manage Rewards */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center">
            <Award size={14} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">My Rewards Library</h2>
        </div>
        <Link
          href="/dashboard/loyalty/manage"
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-brand-pink-light)] text-[var(--color-brand-pink-dark)] text-sm font-semibold hover:bg-[var(--color-brand-pink)] hover:text-white transition-colors cursor-pointer"
        >
          <Settings size={14} /> Manage
        </Link>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        Rewards that clients can redeem with their loyalty points or earn through stamp cards.
      </p>

      {myRewards.length === 0 ? (
        <div className="glass-card p-10 text-center border border-dashed border-[var(--color-border-light)]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-200 to-pink-200 flex items-center justify-center mx-auto mb-3">
            <Gift size={28} className="text-amber-500" />
          </div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">No rewards yet</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-4">
            Create rewards that clients can redeem with points or unlock with stamp cards.
          </p>
          <Link
            href="/dashboard/loyalty/manage"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full btn-pink text-sm font-bold cursor-pointer"
          >
            <Plus size={14} /> Create First Reward
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myRewards.map((reward) => (
            <div
              key={reward.id}
              className={`glass-card p-5 flex items-center gap-4 ${!reward.is_active ? 'opacity-60' : ''}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center shadow-md shrink-0">
                <Gift size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--color-text-primary)] truncate">{reward.name}</h3>
                  {!reward.is_active && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                      Paused
                    </span>
                  )}
                </div>
                {rewardTypeLabel(reward) && (
                  <p className="text-xs text-[var(--color-brand-pink-dark)] font-semibold">{rewardTypeLabel(reward)}</p>
                )}
                {reward.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">{reward.description}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-amber-500">{reward.points_cost}</p>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">pts</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
