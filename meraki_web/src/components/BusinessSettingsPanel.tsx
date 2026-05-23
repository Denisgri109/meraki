'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Save, Loader2, Plus, Pencil, Trash2, Pause, Play,
  Wallet, Clock, UserX, Heart, FileText, Eye, X,
  Megaphone,
} from 'lucide-react';
import type { Json } from '@/types/database';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BusinessSettings {
  confirmation_timing_hours: number;
  confirmation_response_timeout_hours: number;
  auto_charge_after_grace_period: boolean;
  deposit_type: string;
  deposit_amount: number;
  deposit_percentage: number;
  terms_and_conditions: string | null;
  require_tc_acceptance: boolean;
  accepts_new_clients: boolean;
  is_visible_globally: boolean;
}


interface Campaign {
  id: string;
  name: string;
  message: string;
  campaign_type: string;
  is_recurring: boolean;
  days_after_appointment: number | null;
  service_category: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: BusinessSettings = {
  confirmation_timing_hours: 24,
  confirmation_response_timeout_hours: 24,
  auto_charge_after_grace_period: true,
  deposit_type: 'percentage',
  deposit_amount: 0,
  deposit_percentage: 100,
  terms_and_conditions: null,
  require_tc_acceptance: true,
  accepts_new_clients: true,
  is_visible_globally: true,
};


const CONFIRMATION_TIMING_OPTIONS = [
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
  { value: 72, label: '72 hours before' },
];

const RESPONSE_TIMEOUT_OPTIONS = [
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
];


const DEPOSIT_PERCENT_OPTIONS = [10, 20, 30, 50, 100];

const AFTERCARE_DAY_OPTIONS = [7, 14, 21, 30, 45, 60, 90];

const CAMPAIGN_TYPES = [
  { value: 'aftercare', label: 'Aftercare Reminder', emoji: '\u{1F486}', desc: 'Sent X days after appointment' },
  { value: 'promotion', label: 'Promotion', emoji: '\u{1F389}', desc: 'Special offer for clients' },
  { value: 'vacation', label: 'Vacation Notice', emoji: '\u{1F3D6}\uFE0F', desc: "Let clients know you're away" },
  { value: 'announcement', label: 'Announcement', emoji: '\u{1F4E2}', desc: 'General update for clients' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function SectionCard({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={18} className="text-[var(--color-primary)]" />
        <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-5">{description}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] cursor-pointer">
      <span>
        <span className="block font-medium text-sm text-[var(--color-text-primary)]">{label}</span>
        {description && <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{description}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[var(--color-primary)] cursor-pointer"
      />
    </label>
  );
}

function SelectField({ value, onChange, options, className }: {
  value: number | string;
  onChange: (v: string) => void;
  options: { value: number | string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`input-glass text-sm cursor-pointer ${className || ''}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BusinessSettingsPanel() {
  const { profile } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);

  const [tcModalOpen, setTcModalOpen] = useState(false);
  const [tcDraft, setTcDraft] = useState('');

  // Deposit derived state
  const depositEnabled =
    settings.deposit_type === 'percentage'
      ? settings.deposit_percentage > 0
      : settings.deposit_amount > 0;

  // ─── Aftercare Campaigns ──────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignEditorOpen, setCampaignEditorOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campForm, setCampForm] = useState({
    name: '',
    message: '',
    campaign_type: 'aftercare' as string,
    is_recurring: true,
    days_after_appointment: 30,
    start_date: '',
    end_date: '',
  });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // ─── Load Settings ────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Load master_settings
      const { data: ms, error: msErr } = await supabase
        .from('master_settings')
        .select('*')
        .eq('master_id', profile.id)
        .maybeSingle();

      if (msErr && (msErr as { code?: string }).code !== 'PGRST116') {
        console.error('Error loading master_settings:', msErr);
      }

      if (ms) {
        setSettings({
          confirmation_timing_hours: ms.confirmation_timing_hours ?? 24,
          confirmation_response_timeout_hours: ms.confirmation_response_timeout_hours ?? 24,
          auto_charge_after_grace_period: ms.auto_charge_after_grace_period ?? true,
          deposit_type: ms.deposit_type || 'percentage',
          deposit_amount: Number(ms.deposit_amount ?? 0),
          deposit_percentage: ms.deposit_percentage ?? 100,
          terms_and_conditions: ms.terms_and_conditions ?? null,
          require_tc_acceptance: ms.require_tc_acceptance ?? true,
          accepts_new_clients: ms.accepts_new_clients ?? true,
          is_visible_globally: ms.is_visible_globally ?? true,
        });
        setTcDraft(ms.terms_and_conditions || '');
      } else {
        // Upsert default row if none exists
        await supabase
          .from('master_settings')
          .upsert({ master_id: profile.id }, { onConflict: 'master_id' });
      }


      // Load aftercare campaigns
      const { data: camps } = await supabase
        .from('aftercare_campaigns')
        .select('*')
        .eq('master_id', profile.id)
        .order('created_at', { ascending: false });

      setCampaigns((camps as Campaign[]) || []);
    } catch (err) {
      console.error('Error loading business settings:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, supabase]);

  useEffect(() => {
    loadAll(); // eslint-disable-line react-hooks/set-state-in-effect -- data fetch on mount
  }, [loadAll]);

  // ─── Save Settings ────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      // Save master_settings
      const { error: msErr } = await supabase
        .from('master_settings')
        .upsert(
          {
            master_id: profile.id,
            confirmation_timing_hours: settings.confirmation_timing_hours,
            confirmation_response_timeout_hours: settings.confirmation_response_timeout_hours,
            late_cancellation_window_hours: 24,
            cancellation_charge_percent: 50,
            no_show_charge_percent: 100,
            late_arrival_minutes: 15,
            grace_period_multiplier: 0.5,
            auto_charge_after_grace_period: settings.auto_charge_after_grace_period,
            deposit_type: settings.deposit_type,
            deposit_amount: settings.deposit_amount,
            deposit_percentage: settings.deposit_percentage,
            terms_and_conditions: settings.terms_and_conditions,
            require_tc_acceptance: settings.require_tc_acceptance,
            accepts_new_clients: settings.accepts_new_clients,
            is_visible_globally: settings.is_visible_globally,
            terms_updated_at: settings.terms_and_conditions ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'master_id' }
        );

      if (msErr) throw msErr;


      showToast('Business settings saved!', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save settings'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Deposit Toggle ───────────────────────────────────────────────────────

  const toggleDeposit = (enabled: boolean) => {
    if (enabled) {
      setSettings((s) => ({
        ...s,
        deposit_type: 'percentage',
        deposit_percentage: 20,
        deposit_amount: 0,
      }));
    } else {
      setSettings((s) => ({
        ...s,
        deposit_percentage: 0,
        deposit_amount: 0,
      }));
    }
  };

  // ─── Campaign CRUD ────────────────────────────────────────────────────────

  const openCampaignEditor = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setCampForm({
        name: campaign.name,
        message: campaign.message,
        campaign_type: campaign.campaign_type,
        is_recurring: campaign.is_recurring,
        days_after_appointment: campaign.days_after_appointment ?? 30,
        start_date: campaign.start_date || '',
        end_date: campaign.end_date || '',
      });
    } else {
      setEditingCampaign(null);
      setCampForm({
        name: '',
        message: '',
        campaign_type: 'aftercare',
        is_recurring: true,
        days_after_appointment: 30,
        start_date: '',
        end_date: '',
      });
    }
    setCampaignEditorOpen(true);
  };

  const handleSaveCampaign = async () => {
    if (!profile?.id) return;
    if (!campForm.name.trim() || !campForm.message.trim()) {
      showToast('Campaign name and message are required', 'error');
      return;
    }
    setSavingCampaign(true);
    try {
      const payload = {
        master_id: profile.id,
        name: campForm.name.trim(),
        message: campForm.message.trim(),
        campaign_type: campForm.campaign_type,
        is_recurring: campForm.campaign_type === 'aftercare' ? campForm.is_recurring : false,
        days_after_appointment: campForm.campaign_type === 'aftercare' ? campForm.days_after_appointment : null,
        start_date: ['vacation', 'promotion'].includes(campForm.campaign_type) && campForm.start_date ? campForm.start_date : null,
        end_date: ['vacation', 'promotion'].includes(campForm.campaign_type) && campForm.end_date ? campForm.end_date : null,
        is_active: true,
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('aftercare_campaigns')
          .update({
            name: payload.name,
            message: payload.message,
            campaign_type: payload.campaign_type,
            is_recurring: payload.is_recurring,
            days_after_appointment: payload.days_after_appointment,
            start_date: payload.start_date,
            end_date: payload.end_date,
            is_active: payload.is_active,
          })
          .eq('id', editingCampaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('aftercare_campaigns')
          .insert({
            master_id: payload.master_id,
            name: payload.name,
            message: payload.message,
            campaign_type: payload.campaign_type,
            is_recurring: payload.is_recurring,
            days_after_appointment: payload.days_after_appointment,
            start_date: payload.start_date,
            end_date: payload.end_date,
            is_active: payload.is_active,
          });
        if (error) throw error;
      }

      showToast(editingCampaign ? 'Campaign updated!' : 'Campaign created!', 'success');
      setCampaignEditorOpen(false);
      await loadAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save campaign'), 'error');
    } finally {
      setSavingCampaign(false);
    }
  };

  const toggleCampaignActive = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from('aftercare_campaigns')
        .update({ is_active: !campaign.is_active })
        .eq('id', campaign.id);
      if (error) throw error;
      await loadAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update campaign'), 'error');
    }
  };

  const deleteCampaign = async (campaign: Campaign) => {
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('aftercare_campaigns')
        .delete()
        .eq('id', campaign.id);
      if (error) throw error;
      showToast('Campaign deleted', 'success');
      await loadAll();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete campaign'), 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <Loader2 size={16} className="animate-spin" />
        Loading business settings...
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ═══ Deposit Configuration ═══ */}
      <SectionCard icon={Wallet} title="Deposit Configuration" description="Require clients to pay a deposit when booking your services.">
        <Toggle
          checked={depositEnabled}
          onChange={toggleDeposit}
          label="Require Deposit"
          description="Clients must pay a deposit to secure their booking"
        />

        {depositEnabled && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Deposit type toggle */}
            <div>
              <label className="label-upper">Deposit Mode</label>
              <div className="flex gap-2">
                {(['percentage', 'fixed'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSettings((s) => ({
                      ...s,
                      deposit_type: t,
                      deposit_percentage: t === 'percentage' ? (s.deposit_percentage || 20) : 0,
                      deposit_amount: t === 'fixed' ? (s.deposit_amount || 20) : 0,
                    }))}
                    className={`flex-1 py-2 px-4 rounded-[var(--radius-lg)] text-sm font-medium border transition-all cursor-pointer ${
                      settings.deposit_type === t
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    {t === 'percentage' ? 'Percentage (%)' : 'Fixed Amount'}
                  </button>
                ))}
              </div>
            </div>

            {settings.deposit_type === 'percentage' ? (
              <div>
                <label className="label-upper">Deposit Percentage</label>
                <div className="flex gap-2 flex-wrap">
                  {DEPOSIT_PERCENT_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setSettings((s) => ({ ...s, deposit_percentage: pct }))}
                      className={`px-4 py-2 rounded-[var(--radius-lg)] text-sm font-semibold border transition-all cursor-pointer ${
                        settings.deposit_percentage === pct
                          ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                          : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border-[var(--color-border-light)]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="label-upper">Fixed Deposit Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm font-medium">&euro;</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={settings.deposit_amount || ''}
                    onChange={(e) => setSettings((s) => ({ ...s, deposit_amount: Number(e.target.value) || 0 }))}
                    className="input-glass pl-7"
                    placeholder="20.00"
                  />
                </div>
              </div>
            )}

            <div className="p-3 rounded-[var(--radius-md)] bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>Per-Service Deposit Override:</strong> You can override deposit settings for individual services from the{' '}
              <a href="/dashboard/services" className="underline font-semibold hover:text-amber-900">Service Management</a> page (Phase 4).
            </div>
          </div>
        )}
      </SectionCard>

      {/* ═══ Confirmation Settings ═══ */}
      <SectionCard icon={Clock} title="Appointment Confirmations" description="When should clients receive confirmation reminders and how long they have to respond.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-upper">Confirmation Timing</label>
            <SelectField
              value={settings.confirmation_timing_hours}
              onChange={(v) => setSettings((s) => ({ ...s, confirmation_timing_hours: Number(v) }))}
              options={CONFIRMATION_TIMING_OPTIONS}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">When clients receive a &quot;confirm your appointment&quot; reminder</p>
          </div>
          <div>
            <label className="label-upper">Response Timeout</label>
            <SelectField
              value={settings.confirmation_response_timeout_hours}
              onChange={(v) => setSettings((s) => ({ ...s, confirmation_response_timeout_hours: Number(v) }))}
              options={RESPONSE_TIMEOUT_OPTIONS}
            />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">How long clients have to respond before auto-cancel</p>
          </div>
        </div>
        <div className="mt-4">
          <Toggle
            checked={settings.auto_charge_after_grace_period}
            onChange={(v) => setSettings((s) => ({ ...s, auto_charge_after_grace_period: v }))}
            label="Auto-Cancel Unconfirmed"
            description="Automatically cancel appointments if client doesn't confirm within the timeout"
          />
        </div>
      </SectionCard>

      {/* ═══ Cancellation & No-Show Policy (Fixed) ═══ */}
      <SectionCard icon={UserX} title="Cancellation & No-Show Policy" description="Platform-wide policy applied to all bookings.">
        <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Cancel for free up to <span className="font-bold text-[var(--color-text-primary)]">24 hours</span> before your session.
          Cancellations within this window are subject to a <span className="font-bold text-[var(--color-text-primary)]">50% fee</span>.
          No-Shows are billed at <span className="font-bold text-[var(--color-text-primary)]">100%</span>.
        </div>
      </SectionCard>

      {/* ═══ Terms & Conditions ═══ */}
      <SectionCard icon={FileText} title="Terms & Conditions" description="Set your booking terms. Clients must accept these before booking.">
        <button
          onClick={() => { setTcDraft(settings.terms_and_conditions || ''); setTcModalOpen(true); }}
          className="w-full p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-colors text-sm font-medium text-[var(--color-primary)] cursor-pointer flex items-center justify-center gap-2"
        >
          {settings.terms_and_conditions ? <><Pencil size={14} /> Edit Terms</> : <><Plus size={14} /> Add Terms</>}
        </button>

        {settings.terms_and_conditions && (
          <div className="mt-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-light)] text-xs text-[var(--color-text-secondary)] italic line-clamp-3">
            {settings.terms_and_conditions}
          </div>
        )}

        <div className="mt-3">
          <Toggle
            checked={settings.require_tc_acceptance}
            onChange={(v) => setSettings((s) => ({ ...s, require_tc_acceptance: v }))}
            label="Require Acceptance"
            description="Clients must accept T&C before booking"
          />
        </div>
      </SectionCard>

      {/* ═══ Visibility ═══ */}
      <SectionCard icon={Eye} title="Visibility" description="Control how clients find and book with you.">
        <div className="space-y-3">
          <Toggle
            checked={settings.accepts_new_clients}
            onChange={(v) => setSettings((s) => ({ ...s, accepts_new_clients: v }))}
            label="Accept New Clients"
            description="Allow new clients to book with you"
          />
          <Toggle
            checked={settings.is_visible_globally}
            onChange={(v) => setSettings((s) => ({ ...s, is_visible_globally: v }))}
            label="Show in Global Discovery"
            description="Appear in search results for clients in your area"
          />
        </div>
      </SectionCard>


      {/* ═══ Save Settings Button ═══ */}
      <button
        onClick={handleSaveSettings}
        disabled={saving}
        className="btn-primary flex items-center gap-2 px-6 py-3 text-sm cursor-pointer mb-6"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save Business Settings'}
      </button>

      {/* ═══ Aftercare Campaigns ═══ */}
      <SectionCard icon={Heart} title="Aftercare Campaigns" description="Create aftercare reminders, promotions, or vacation notices for your clients.">
        {/* Campaign List */}
        {campaigns.length === 0 && !campaignEditorOpen && (
          <div className="text-center py-8">
            <Megaphone size={36} className="mx-auto text-[var(--color-text-muted)] mb-3" />
            <p className="font-semibold text-sm text-[var(--color-text-primary)] mb-1">No Campaigns Yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">Create aftercare reminders, promotions, or vacation notices</p>
          </div>
        )}

        {campaigns.map((c) => (
          <div key={c.id} className={`p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface-light)] mb-3 ${!c.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{CAMPAIGN_TYPES.find((t) => t.value === c.campaign_type)?.emoji || '\u{1F4E2}'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{c.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    {c.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {CAMPAIGN_TYPES.find((t) => t.value === c.campaign_type)?.label}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{c.message}</p>
                {c.campaign_type === 'aftercare' && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {c.days_after_appointment} days after appointment{c.is_recurring ? ' \u00B7 Recurring' : ''}
                  </p>
                )}
                {['vacation', 'promotion'].includes(c.campaign_type) && c.start_date && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {c.start_date} \u2014 {c.end_date || 'ongoing'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-3 pt-3 border-t border-[var(--color-border-light)]">
              <button onClick={() => openCampaignEditor(c)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => toggleCampaignActive(c)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer">
                {c.is_active ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
              </button>
              <button onClick={() => deleteCampaign(c)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}

        {/* New Campaign Button */}
        {!campaignEditorOpen && (
          <button
            onClick={() => openCampaignEditor()}
            className="w-full p-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-light)] hover:border-[var(--color-primary)] text-sm font-medium text-[var(--color-primary)] cursor-pointer flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} /> New Campaign
          </button>
        )}

        {/* Campaign Editor */}
        {campaignEditorOpen && (
          <div className="mt-4 p-5 rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-white animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">
                {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
              </h4>
              <button onClick={() => setCampaignEditorOpen(false)} className="p-1 hover:bg-black/5 rounded-full cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Campaign Type */}
            <div className="mb-4">
              <label className="label-upper">Campaign Type</label>
              <div className="grid grid-cols-2 gap-2">
                {CAMPAIGN_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setCampForm((f) => ({ ...f, campaign_type: t.value }))}
                    className={`p-3 rounded-[var(--radius-lg)] border text-left transition-all cursor-pointer ${
                      campForm.campaign_type === t.value
                        ? 'border-[var(--color-primary)] bg-amber-50'
                        : 'border-[var(--color-border-light)] bg-[var(--color-surface-light)] hover:border-[var(--color-primary)]'
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-1">{t.label}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="label-upper">Campaign Name *</label>
              <input
                type="text"
                value={campForm.name}
                onChange={(e) => setCampForm((f) => ({ ...f, name: e.target.value }))}
                className="input-glass"
                placeholder="e.g., Brow Touch-up Reminder"
              />
            </div>

            {/* Message */}
            <div className="mb-4">
              <label className="label-upper">Message *</label>
              <textarea
                value={campForm.message}
                onChange={(e) => setCampForm((f) => ({ ...f, message: e.target.value }))}
                className="input-glass resize-none"
                rows={3}
                placeholder="Hi {name}! It's time for your touch-up appointment..."
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Use {'{name}'} for client&apos;s name</p>
            </div>

            {/* Aftercare timing */}
            {campForm.campaign_type === 'aftercare' && (
              <>
                <div className="mb-4">
                  <label className="label-upper">Send After (days)</label>
                  <div className="flex gap-2 flex-wrap">
                    {AFTERCARE_DAY_OPTIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setCampForm((f) => ({ ...f, days_after_appointment: d }))}
                        className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold border transition-all cursor-pointer ${
                          campForm.days_after_appointment === d
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border-[var(--color-border-light)]'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <Toggle
                    checked={campForm.is_recurring}
                    onChange={(v) => setCampForm((f) => ({ ...f, is_recurring: v }))}
                    label="Recurring"
                    description="Send after every completed appointment"
                  />
                </div>
              </>
            )}

            {/* Date range for vacation/promotion */}
            {['vacation', 'promotion'].includes(campForm.campaign_type) && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="label-upper">Start Date</label>
                  <input
                    type="date"
                    value={campForm.start_date}
                    onChange={(e) => setCampForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="input-glass text-sm"
                  />
                </div>
                <div>
                  <label className="label-upper">End Date</label>
                  <input
                    type="date"
                    value={campForm.end_date}
                    onChange={(e) => setCampForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="input-glass text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveCampaign}
                disabled={savingCampaign}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm cursor-pointer"
              >
                {savingCampaign ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {savingCampaign ? 'Saving...' : editingCampaign ? 'Update Campaign' : 'Create Campaign'}
              </button>
              <button
                onClick={() => setCampaignEditorOpen(false)}
                className="px-5 py-2.5 text-sm rounded-[var(--radius-lg)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ═══ T&C Modal ═══ */}
      {tcModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setTcModalOpen(false)}
        >
          <div
            className="glass-card max-w-2xl w-full p-6 relative animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--color-text-primary)]">Terms & Conditions</h3>
              <button onClick={() => setTcModalOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={tcDraft}
              onChange={(e) => setTcDraft(e.target.value)}
              className="input-glass resize-none w-full"
              rows={12}
              placeholder={"Enter your Terms & Conditions here...\n\nExample:\n- Cancellation Policy: Appointments cancelled within 24 hours will be charged 50%.\n- Late Arrivals: If you are more than 15 minutes late, the appointment may be cancelled.\n- Payment: Full payment is due at the time of service."}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setTcModalOpen(false)}
                className="px-5 py-2.5 text-sm rounded-[var(--radius-lg)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSettings((s) => ({ ...s, terms_and_conditions: tcDraft.trim() || null }));
                  setTcModalOpen(false);
                }}
                className="btn-primary px-5 py-2.5 text-sm cursor-pointer"
              >
                Save Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
