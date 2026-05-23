'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  Bell, Send, History, Target, Loader2, Users, Filter,
  ChevronDown, CheckCircle, AlertCircle, Clock, Search,
  Megaphone, X, RefreshCw, Mail
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface NotificationLogEntry {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  sent_at: string;
  delivered: boolean;
  error_message: string | null;
  appointment_id: string | null;
  campaign_id: string | null;
  user_name?: string;
}

interface ClientProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  push_token: string | null;
}

type TabValue = 'send' | 'history' | 'campaigns';
type AudienceFilter = 'all' | 'clients' | 'masters';
type HistoryFilter = 'all' | 'delivered' | 'failed' | 'promotional';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  // Redirect non-owners
  if (role !== 'owner') {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <Bell size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Access Restricted</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">Notification management is only available for owners.</p>
      </div>
    );
  }

  return <NotificationsContent userId={user?.id || ''} />;
}

function NotificationsContent({ userId }: { userId: string }) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabValue>('send');
  const [loading, setLoading] = useState(true);

  // History
  const [notificationHistory, setNotificationHistory] = useState<NotificationLogEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Send form
  const [sendTitle, setSendTitle] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [sendAudience, setSendAudience] = useState<AudienceFilter>('all');
  const [sending, setSending] = useState(false);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [useTargeted, setUseTargeted] = useState(false);

  // Campaigns
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; body: string; audience: string; sent_count: number; created_at: string }[]>([]);

  // ─── Load data ──────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Load notification_log with user info
      const { data, error } = await supabase
        .from('notification_log')
        .select('*, profiles:user_id(full_name)')
        .order('sent_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const entries: NotificationLogEntry[] = (data || []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        user_id: n.user_id as string,
        notification_type: n.notification_type as string,
        title: n.title as string,
        body: n.body as string,
        data: n.data as Record<string, unknown> | null,
        sent_at: n.sent_at as string,
        delivered: n.delivered as boolean,
        error_message: n.error_message as string | null,
        appointment_id: n.appointment_id as string | null,
        campaign_id: n.campaign_id as string | null,
        user_name: (n.profiles as unknown as { full_name: string } | null)?.full_name || 'Unknown',
      }));

      setNotificationHistory(entries);

      // Derive campaign stats from data.campaign_id or notification_type
      const campaignMap = new Map<string, { title: string; body: string; sent_count: number; created_at: string }>();
      for (const entry of entries) {
        const dataCampaignId = (entry.data as Record<string, unknown> | null)?.campaign_id as string | undefined;
        if (dataCampaignId || entry.notification_type === 'promotional') {
          const key = dataCampaignId || `promo_${entry.sent_at?.slice(0, 16)}`;
          const existing = campaignMap.get(key);
          if (existing) {
            existing.sent_count++;
          } else {
            campaignMap.set(key, {
              title: entry.title,
              body: entry.body,
              sent_count: 1,
              created_at: entry.sent_at,
            });
          }
        }
      }
      setCampaigns(Array.from(campaignMap.entries()).map(([id, c]) => ({
        id,
        title: c.title,
        body: c.body,
        audience: `${c.sent_count} recipient${c.sent_count !== 1 ? 's' : ''}`,
        sent_count: c.sent_count,
        created_at: c.created_at,
      })));

    } catch (err) {
      console.error('Failed to load notification history:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadClients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, push_token')
        .in('role', ['client', 'master'])
        .order('full_name');
      setClients((data || []) as ClientProfile[]);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  }, [supabase]);

  useEffect(() => { loadHistory(); loadClients(); }, [loadHistory, loadClients]);

  // ─── Send notification ────────────────────────────────────────
  const handleSend = async () => {
    if (!sendTitle.trim() || !sendBody.trim()) {
      showToast('Title and message are required', 'error');
      return;
    }

    setSending(true);
    try {
      // Determine target users
      let targetUsers: ClientProfile[];
      if (useTargeted && selectedClients.length > 0) {
        targetUsers = clients.filter(c => selectedClients.includes(c.id));
      } else {
        targetUsers = clients.filter(c => {
          if (sendAudience === 'clients') return c.role === 'client';
          if (sendAudience === 'masters') return c.role === 'master';
          return true;
        });
      }

      if (targetUsers.length === 0) {
        showToast('No recipients selected', 'error');
        setSending(false);
        return;
      }

      // Create notification_log entries for each target
      const campaignId = crypto.randomUUID();
      const notificationRows = targetUsers.map(u => ({
        user_id: u.id,
        notification_type: 'promotional',
        title: sendTitle.trim(),
        body: sendBody.trim(),
        data: { campaign_id: campaignId, audience: sendAudience },
        sent_at: new Date().toISOString(),
        delivered: !!u.push_token,
        error_message: u.push_token ? null : 'No push token registered',
      }));

      const { error } = await supabase
        .from('notification_log')
        .insert(notificationRows);

      if (error) throw error;

      // Also create scheduled_notifications for in-app display
      const scheduledRows = targetUsers.map(u => ({
        user_id: u.id,
        type: 'promotional',
        title: sendTitle.trim(),
        body: sendBody.trim(),
        data: { campaign_id: campaignId },
        scheduled_for: new Date().toISOString(),
      }));

      await supabase.from('scheduled_notifications').insert(scheduledRows);

      showToast(`Notification sent to ${targetUsers.length} recipient${targetUsers.length !== 1 ? 's' : ''}`, 'success');
      setSendTitle('');
      setSendBody('');
      setSelectedClients([]);
      setUseTargeted(false);
      loadHistory();
    } catch (err) {
      showToast('Failed to send notification', 'error');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // ─── Filtered history ─────────────────────────────────────────
  const filteredHistory = notificationHistory.filter(n => {
    const matchesFilter = historyFilter === 'all' ||
      (historyFilter === 'delivered' && n.delivered) ||
      (historyFilter === 'failed' && !n.delivered) ||
      (historyFilter === 'promotional' && n.notification_type === 'promotional');
    const matchesSearch = !historySearch ||
      n.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      n.user_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      n.body.toLowerCase().includes(historySearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const tabs: { label: string; value: TabValue; icon: React.ElementType }[] = [
    { label: 'Send Push', value: 'send', icon: Send },
    { label: 'History', value: 'history', icon: History },
    { label: 'Campaigns', value: 'campaigns', icon: Target },
  ];

  const audienceClients = clients.filter(c => {
    if (sendAudience === 'clients') return c.role === 'client';
    if (sendAudience === 'masters') return c.role === 'master';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Notifications</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Send promotional push notifications and view notification history
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-surface-light)] rounded-2xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                activeTab === tab.value
                  ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Send Tab ──────────────────────────────────────────────── */}
      {activeTab === 'send' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center">
                <Megaphone size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Send Promotional Push</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Compose and send push notifications to your users</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-upper">Title</label>
                <input
                  type="text"
                  value={sendTitle}
                  onChange={e => setSendTitle(e.target.value)}
                  placeholder="Special Offer This Weekend!"
                  className="input-glass w-full"
                  maxLength={100}
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{sendTitle.length}/100</p>
              </div>

              <div>
                <label className="label-upper">Message</label>
                <textarea
                  value={sendBody}
                  onChange={e => setSendBody(e.target.value)}
                  placeholder="Get 20% off all services this Saturday..."
                  rows={3}
                  className="input-glass w-full resize-none"
                  maxLength={500}
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{sendBody.length}/500</p>
              </div>

              {/* Audience */}
              <div>
                <label className="label-upper">Audience</label>
                <div className="flex gap-2 mb-3">
                  {(['all', 'clients', 'masters'] as AudienceFilter[]).map(a => (
                    <button
                      key={a}
                      onClick={() => { setSendAudience(a); setUseTargeted(false); setSelectedClients([]); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        sendAudience === a && !useTargeted
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                      }`}
                    >
                      {a === 'all' ? `All Users (${clients.length})` :
                       a === 'clients' ? `Clients (${clients.filter(c => c.role === 'client').length})` :
                       `Masters (${clients.filter(c => c.role === 'master').length})`}
                    </button>
                  ))}
                  <button
                    onClick={() => setUseTargeted(!useTargeted)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      useTargeted
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                    }`}
                  >
                    <Target size={12} className="inline mr-1" />
                    Targeted
                  </button>
                </div>

                {/* Targeted selection */}
                {useTargeted && (
                  <div className="rounded-xl border border-[var(--color-border-light)] p-3 max-h-48 overflow-y-auto space-y-1">
                    {audienceClients.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] text-center py-4">No users found</p>
                    ) : (
                      audienceClients.map(c => (
                        <label key={c.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-light)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(c.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedClients(prev => [...prev, c.id]);
                              else setSelectedClients(prev => prev.filter(id => id !== c.id));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-[var(--color-text-primary)]">{c.full_name || c.email || 'Unknown'}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)] uppercase">{c.role}</span>
                          {!c.push_token && (
                            <span className="text-[10px] text-amber-500 ml-auto">No push token</span>
                          )}
                        </label>
                      ))
                    )}
                    {useTargeted && selectedClients.length > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border-light)]">
                        {selectedClients.length} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSend}
                  disabled={sending || !sendTitle.trim() || !sendBody.trim()}
                  className="btn-pink px-5 py-2.5 text-sm flex items-center gap-2"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send Notification
                </button>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {useTargeted
                    ? `${selectedClients.length} recipient${selectedClients.length !== 1 ? 's' : ''}`
                    : `${audienceClients.length} recipient${audienceClients.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          {sendTitle && (
            <div className="glass-card p-5">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Preview</p>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-light)]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center shrink-0">
                  <Bell size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{sendTitle}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sendBody || 'Message body...'}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Just now</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── History Tab ───────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search notifications..."
                className="input-glass w-full pl-9 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'delivered', 'failed', 'promotional'] as HistoryFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    historyFilter === f
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={loadHistory} disabled={loading} className="p-2 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer shrink-0">
              <RefreshCw size={16} className={`text-[var(--color-text-muted)] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Notification History</h4>
              <span className="text-xs text-[var(--color-text-muted)]">{filteredHistory.length} entries</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-16">
                <History size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No notifications found</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)] max-h-[600px] overflow-y-auto">
                {filteredHistory.map(n => (
                  <div key={n.id} className="px-6 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      n.delivered ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {n.delivered
                        ? <CheckCircle size={14} className="text-emerald-600" />
                        : <AlertCircle size={14} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{n.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{n.body}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {n.user_name} · {formatDateTime(n.sent_at)} · <span className="uppercase">{n.notification_type}</span>
                      </p>
                    </div>
                    {n.error_message && (
                      <span className="text-[10px] text-red-400 shrink-0 max-w-[120px] truncate" title={n.error_message}>
                        {n.error_message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Campaigns Tab ─────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center">
              <Target size={20} className="text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Targeted Campaigns</h3>
              <p className="text-xs text-[var(--color-text-muted)]">View sent promotional campaigns and their reach</p>
            </div>
          </div>

          {loading ? (
            <div className="glass-card flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="glass-card text-center py-16">
              <Megaphone size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
              <p className="text-[var(--color-text-secondary)] font-medium">No campaigns yet</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Campaigns appear here when you send promotional notifications</p>
              <button onClick={() => setActiveTab('send')} className="btn-pink px-4 py-2 text-sm mt-4 inline-flex items-center gap-2">
                <Send size={14} /> Create Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => (
                <div key={c.id} className="glass-card p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
                    <Megaphone size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{c.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{c.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        <Users size={10} className="inline mr-1" />{c.audience}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        <Clock size={10} className="inline mr-1" />{formatDateTime(c.created_at)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                    {c.sent_count} sent
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
