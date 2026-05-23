'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  HelpCircle, MessageCircle, Mail, Phone, Clock, ChevronDown,
  ChevronUp, Plus, Pencil, Trash2, Save, X, Loader2, Settings,
  ExternalLink, Search, Shield, BookOpen
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

interface SupportSettings {
  email: string;
  phone: string;
  hours: string;
  address: string;
  additional_info: string;
}

type TabValue = 'faq' | 'contact' | 'settings';

const FAQ_CATEGORIES = ['General', 'Bookings', 'Payments', 'Account', 'Shop', 'Academy', 'Loyalty'];

const DEFAULT_FAQS: FaqItem[] = [
  { id: '1', question: 'How do I book an appointment?', answer: 'Navigate to the Book section from the menu, select a service and specialist, choose your preferred date and time, then complete the booking with payment.', category: 'Bookings', order: 0 },
  { id: '2', question: 'Can I cancel or reschedule my appointment?', answer: 'Yes. Go to My Appointments, tap the appointment you wish to change, and select Cancel or Reschedule. Please note that late cancellations (within 24 hours) may incur a fee as per the cancellation policy.', category: 'Bookings', order: 1 },
  { id: '3', question: 'How do deposits work?', answer: 'Some services require a deposit at the time of booking. The deposit is applied toward your total service cost. The remaining balance is due at the salon on the day of your appointment.', category: 'Payments', order: 2 },
  { id: '4', question: 'What payment methods are accepted?', answer: 'We accept all major credit and debit cards through our secure Stripe payment system. You can save multiple cards for faster checkout.', category: 'Payments', order: 3 },
  { id: '5', question: 'How do I earn loyalty points?', answer: 'Earn points by scanning QR codes at the salon after your appointment. Points accumulate on your loyalty card and can be redeemed for rewards once you reach the required stamps.', category: 'Loyalty', order: 4 },
  { id: '6', question: 'How do I update my profile or change my email?', answer: 'Go to Settings from the menu. You can update your name, photo, and bio in the Profile section, and change your email or password in the Security section.', category: 'Account', order: 5 },
  { id: '7', question: 'How do refunds work?', answer: 'Refunds are processed by the salon owner. If eligible, refunds are returned to your original payment method and typically appear within 5-10 business days.', category: 'Payments', order: 6 },
  { id: '8', question: 'How do I access courses in the Academy?', answer: 'Navigate to the Academy section. Browse available courses, enroll, and start learning. Track your progress and complete lessons at your own pace.', category: 'Academy', order: 7 },
];

const DEFAULT_SUPPORT: SupportSettings = {
  email: '',
  phone: '',
  hours: 'Mon-Fri: 9:00 AM - 6:00 PM',
  address: '',
  additional_info: '',
};

export default function SupportPage() {
  const { user, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();
  const isOwner = role === 'owner';

  const [activeTab, setActiveTab] = useState<TabValue>('faq');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // FAQ state
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // FAQ editor (owner)
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: 'General' });
  const [showFaqModal, setShowFaqModal] = useState(false);

  // Support settings (owner)
  const [supportSettings, setSupportSettings] = useState<SupportSettings>(DEFAULT_SUPPORT);

  // ─── Load data ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load FAQ items from global_settings
      const { data: faqData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'faq_items')
        .maybeSingle();

      if (faqData?.value) {
        try {
          const parsed = JSON.parse(faqData.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFaqs(parsed);
          }
        } catch { /* use defaults */ }
      }

      // Load support settings
      const { data: supportData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'support_settings')
        .maybeSingle();

      if (supportData?.value) {
        try {
          const parsed = JSON.parse(supportData.value);
          setSupportSettings({ ...DEFAULT_SUPPORT, ...parsed });
        } catch { /* use defaults */ }
      }
    } catch (err) {
      console.error('Failed to load support data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Save FAQ items (owner) ───────────────────────────────────
  const saveFaqs = async (updatedFaqs: FaqItem[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'faq_items',
          value: JSON.stringify(updatedFaqs),
          description: 'FAQ items for the support page',
          updated_by: user?.id,
        }, { onConflict: 'key' });

      if (error) throw error;
      setFaqs(updatedFaqs);
      showToast('FAQ items saved', 'success');
    } catch (err) {
      showToast('Failed to save FAQ items', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Save support settings (owner) ────────────────────────────
  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'support_settings',
          value: JSON.stringify(supportSettings),
          description: 'Support contact settings',
          updated_by: user?.id,
        }, { onConflict: 'key' });

      if (error) throw error;
      showToast('Support settings saved', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── FAQ CRUD ─────────────────────────────────────────────────
  const openAddFaq = () => {
    setEditingFaq(null);
    setFaqForm({ question: '', answer: '', category: 'General' });
    setShowFaqModal(true);
  };

  const openEditFaq = (faq: FaqItem) => {
    setEditingFaq(faq);
    setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category });
    setShowFaqModal(true);
  };

  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      showToast('Question and answer are required', 'error');
      return;
    }

    let updated: FaqItem[];
    if (editingFaq) {
      updated = faqs.map(f => f.id === editingFaq.id ? { ...f, ...faqForm } : f);
    } else {
      const newFaq: FaqItem = {
        id: crypto.randomUUID(),
        question: faqForm.question,
        answer: faqForm.answer,
        category: faqForm.category,
        order: faqs.length,
      };
      updated = [...faqs, newFaq];
    }

    await saveFaqs(updated);
    setShowFaqModal(false);
  };

  const handleDeleteFaq = async (id: string) => {
    if (!confirm('Delete this FAQ item?')) return;
    const updated = faqs.filter(f => f.id !== id);
    await saveFaqs(updated);
  };

  // ─── Filtered FAQs ───────────────────────────────────────────
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const faqCategories = ['all', ...new Set(faqs.map(f => f.category))];

  const ownerTabs: { label: string; value: TabValue; icon: React.ElementType }[] = [
    { label: 'FAQ', value: 'faq', icon: HelpCircle },
    { label: 'Contact', value: 'contact', icon: MessageCircle },
    { label: 'Settings', value: 'settings', icon: Settings },
  ];

  const clientTabs: { label: string; value: TabValue; icon: React.ElementType }[] = [
    { label: 'FAQ', value: 'faq', icon: HelpCircle },
    { label: 'Contact', value: 'contact', icon: MessageCircle },
  ];

  const tabs = isOwner ? ownerTabs : clientTabs;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Support</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          {isOwner ? 'Manage FAQ content and support settings' : 'Find answers and get in touch'}
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

      {/* ─── FAQ Tab ───────────────────────────────────────────────── */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search FAQ..."
                className="input-glass w-full pl-9 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {faqCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Owner: Add FAQ button */}
          {isOwner && (
            <div className="flex justify-end">
              <button onClick={openAddFaq} className="btn-pink px-4 py-2 text-sm flex items-center gap-2">
                <Plus size={14} /> Add FAQ
              </button>
            </div>
          )}

          {/* FAQ List */}
          {loading ? (
            <div className="glass-card flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="glass-card text-center py-16">
              <BookOpen size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
              <p className="text-[var(--color-text-secondary)] font-medium">No FAQs found</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {searchQuery ? 'Try a different search term' : 'FAQ items will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFaqs.map(faq => (
                <div key={faq.id} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left cursor-pointer hover:bg-[var(--color-surface-light)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--color-brand-pink-light)] to-pink-100 flex items-center justify-center shrink-0">
                      <HelpCircle size={16} className="text-[var(--color-brand-pink-dark)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{faq.question}</p>
                      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{faq.category}</span>
                    </div>
                    {isOwner && (
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEditFaq(faq)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer" title="Edit">
                          <Pencil size={14} className="text-[var(--color-text-muted)]" />
                        </button>
                        <button onClick={() => handleDeleteFaq(faq.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer" title="Delete">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    )}
                    {expandedFaq === faq.id ? (
                      <ChevronUp size={18} className="text-[var(--color-text-muted)] shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-[var(--color-text-muted)] shrink-0" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-5 pb-4 pt-0 border-t border-[var(--color-border-light)]">
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3 ml-11">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Contact Tab ───────────────────────────────────────────── */}
      {activeTab === 'contact' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-200 to-cyan-200 flex items-center justify-center">
                <MessageCircle size={20} className="text-sky-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Get in Touch</h3>
                <p className="text-xs text-[var(--color-text-muted)]">We&apos;re here to help</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {supportSettings.email && (
                <a
                  href={`mailto:${supportSettings.email}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-border-light)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Email</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{supportSettings.email}</p>
                  </div>
                </a>
              )}

              {supportSettings.phone && (
                <a
                  href={`tel:${supportSettings.phone}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-border-light)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Phone</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{supportSettings.phone}</p>
                  </div>
                </a>
              )}

              {supportSettings.hours && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-light)]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Hours</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{supportSettings.hours}</p>
                  </div>
                </div>
              )}

              {supportSettings.address && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-light)]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center shrink-0">
                    <ExternalLink size={18} className="text-pink-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Address</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{supportSettings.address}</p>
                  </div>
                </div>
              )}
            </div>

            {!supportSettings.email && !supportSettings.phone && (
              <div className="text-center py-8">
                <Shield size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">Contact information not configured yet</p>
                {isOwner && (
                  <button onClick={() => setActiveTab('settings')} className="text-xs text-[var(--color-primary)] hover:underline mt-2 cursor-pointer">
                    Configure in Settings
                  </button>
                )}
              </div>
            )}

            {supportSettings.additional_info && (
              <div className="mt-4 rounded-xl bg-[var(--color-surface-light)] p-4">
                <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{supportSettings.additional_info}</p>
              </div>
            )}
          </div>

          {/* In-app chat link */}
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)]">Chat with us</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Send a message through the in-app chat</p>
            </div>
            <a href="/dashboard/chat" className="btn-pink px-4 py-2 text-sm flex items-center gap-2">
              Open Chat
            </a>
          </div>
        </div>
      )}

      {/* ─── Settings Tab (Owner only) ─────────────────────────────── */}
      {activeTab === 'settings' && isOwner && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center">
                <Settings size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Support Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure contact information shown to clients</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-upper">Support Email</label>
                <input
                  type="email"
                  value={supportSettings.email}
                  onChange={e => setSupportSettings(s => ({ ...s, email: e.target.value }))}
                  placeholder="support@yoursalon.com"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="label-upper">Support Phone</label>
                <input
                  type="tel"
                  value={supportSettings.phone}
                  onChange={e => setSupportSettings(s => ({ ...s, phone: e.target.value }))}
                  placeholder="+353 1 234 5678"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="label-upper">Business Hours</label>
                <input
                  type="text"
                  value={supportSettings.hours}
                  onChange={e => setSupportSettings(s => ({ ...s, hours: e.target.value }))}
                  placeholder="Mon-Fri: 9:00 AM - 6:00 PM"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="label-upper">Address</label>
                <input
                  type="text"
                  value={supportSettings.address}
                  onChange={e => setSupportSettings(s => ({ ...s, address: e.target.value }))}
                  placeholder="123 Beauty Lane, Dublin"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="label-upper">Additional Info</label>
                <textarea
                  value={supportSettings.additional_info}
                  onChange={e => setSupportSettings(s => ({ ...s, additional_info: e.target.value }))}
                  placeholder="Any additional information for clients..."
                  rows={3}
                  className="input-glass w-full resize-none"
                />
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="btn-pink px-5 py-2.5 text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FAQ Modal (Owner) ─────────────────────────────────────── */}
      {showFaqModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setShowFaqModal(false)}>
          <div className="glass-card w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                {editingFaq ? 'Edit FAQ' : 'Add FAQ'}
              </h3>
              <button onClick={() => setShowFaqModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-light)] cursor-pointer">
                <X size={18} className="text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-upper">Category</label>
                <select
                  value={faqForm.category}
                  onChange={e => setFaqForm(f => ({ ...f, category: e.target.value }))}
                  className="input-glass w-full"
                >
                  {FAQ_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-upper">Question</label>
                <input
                  type="text"
                  value={faqForm.question}
                  onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))}
                  placeholder="How do I...?"
                  className="input-glass w-full"
                />
              </div>

              <div>
                <label className="label-upper">Answer</label>
                <textarea
                  value={faqForm.answer}
                  onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))}
                  placeholder="Provide a clear answer..."
                  rows={4}
                  className="input-glass w-full resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFaqModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm font-medium hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleSaveFaq}
                  disabled={saving}
                  className="flex-1 btn-pink px-4 py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingFaq ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
