'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Cog, Info, Loader2, MapPin, Plus, Save, Scissors, ShieldAlert, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import type { Tables, TablesInsert } from '@/types/database';

type Service = Tables<'services'>;
type PilatesSettings = Tables<'pilates_settings'>;
type PilatesHost = Tables<'pilates_hosts'>;
type PilatesTemplate = Tables<'pilates_schedule_templates'>;
type PilatesSessionRow = Tables<'pilates_class_sessions'>;
type PilatesBooking = Pick<Tables<'pilates_session_bookings'>, 'id' | 'status'>;
type PilatesSession = PilatesSessionRow & {
  host: PilatesHost | null;
  pilates_session_bookings: PilatesBooking[] | null;
};
type HostProfile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'role' | 'avatar_url'>;

interface PilatesTimetableManagerProps {
  service: Service;
  /** Called after the underlying service row is updated (e.g. name/price/duration) so parent pages can refresh. */
  onServiceUpdate?: () => void;
}

type TabId = 'schedule' | 'sessions' | 'instructors' | 'settings';

const TABS: { id: TabId; label: string; icon: typeof CalendarDays; hint: string }[] = [
  { id: 'schedule', label: 'Schedule', icon: CalendarDays, hint: 'Weekly template' },
  { id: 'sessions', label: 'Sessions', icon: Clock, hint: 'Upcoming classes' },
  { id: 'instructors', label: 'Instructors', icon: Users, hint: 'Hosts' },
  { id: 'settings', label: 'Settings', icon: Cog, hint: 'Defaults & details' },
];

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
const todayDate = () => new Date().toISOString().slice(0, 10);
const endDate = () => new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const isoPlusDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const defaultSettings = {
  default_capacity: 6,
  default_session_duration_minutes: 50,
  buffer_minutes: 10,
  equipment_provided: true,
  require_health_declaration: true,
  default_level: 'All levels',
  equipment_notes: '',
  location_notes: '',
  operating_days: [0, 1, 2, 3, 4, 5, 6] as number[],
};

export function PilatesTimetableManager({ service, onServiceUpdate }: PilatesTimetableManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hosts, setHosts] = useState<PilatesHost[]>([]);
  const [hostProfiles, setHostProfiles] = useState<HostProfile[]>([]);
  const [templates, setTemplates] = useState<PilatesTemplate[]>([]);
  const [sessions, setSessions] = useState<PilatesSession[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [hostName, setHostName] = useState('');
  const [templateForm, setTemplateForm] = useState({
    day_of_week: 1,
    start_time: '18:00',
    host_id: '',
    capacity: '6',
    duration_minutes: '50',
    level: 'All levels',
    starts_on: todayDate(),
    notes: '',
  });
  const [settingsForm, setSettingsForm] = useState(defaultSettings);
  const [editingSession, setEditingSession] = useState<PilatesSession | null>(null);
  const [sessionForm, setSessionForm] = useState({ host_id: '', capacity: '6', level: 'All levels', status: 'scheduled', notes: '' });
  const [serviceForm, setServiceForm] = useState({
    name: service.name,
    description: service.description || '',
    base_price: String(service.base_price),
    duration_minutes: String(service.duration_minutes),
  });
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    setServiceForm({
      name: service.name,
      description: service.description || '',
      base_price: String(service.base_price),
      duration_minutes: String(service.duration_minutes),
    });
  }, [service.id, service.name, service.description, service.base_price, service.duration_minutes]);

  const groupedSessions = useMemo(() => {
    return sessions.reduce<Record<string, PilatesSession[]>>((acc, session) => {
      const key = new Date(session.starts_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      acc[key] = [...(acc[key] || []), session];
      return acc;
    }, {});
  }, [sessions]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await supabase.rpc('ensure_pilates_sessions', {
        p_service_id: service.id,
        p_start_date: todayDate(),
        p_end_date: endDate(),
      });

      const [hostsRes, profilesRes, templatesRes, settingsRes, sessionsRes] = await Promise.all([
        supabase.from('pilates_hosts').select('*').eq('owner_id', user.id).order('display_name'),
        supabase.from('profiles').select('id, full_name, role, avatar_url').in('role', ['owner', 'master']).order('full_name'),
        supabase.from('pilates_schedule_templates').select('*').eq('service_id', service.id).order('day_of_week').order('start_time'),
        supabase.from('pilates_settings').select('*').eq('service_id', service.id).maybeSingle(),
        supabase
          .from('pilates_class_sessions')
          .select('*, host:pilates_hosts(*), pilates_session_bookings(id, status)')
          .eq('service_id', service.id)
          .gte('starts_at', new Date().toISOString())
          .lt('starts_at', isoPlusDays(35))
          .order('starts_at'),
      ]);

      if (hostsRes.error) throw hostsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      setHosts(hostsRes.data || []);
      setHostProfiles((profilesRes.data as HostProfile[]) || []);
      setTemplates(templatesRes.data || []);
      setSessions((sessionsRes.data as unknown as PilatesSession[]) || []);

      const settings = settingsRes.data as PilatesSettings | null;
      if (settings) {
        setSettingsForm({
          default_capacity: settings.default_capacity,
          default_session_duration_minutes: settings.default_session_duration_minutes,
          buffer_minutes: settings.buffer_minutes,
          equipment_provided: settings.equipment_provided,
          require_health_declaration: settings.require_health_declaration,
          default_level: settings.default_level,
          equipment_notes: settings.equipment_notes || '',
          location_notes: settings.location_notes || '',
          operating_days: Array.isArray(settings.operating_days) && settings.operating_days.length > 0
            ? [...settings.operating_days].sort((a, b) => a - b)
            : [0, 1, 2, 3, 4, 5, 6],
        });
        setTemplateForm((prev) => ({
          ...prev,
          capacity: String(settings.default_capacity),
          duration_minutes: String(settings.default_session_duration_minutes),
          level: settings.default_level,
        }));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load Pilates timetable', 'error');
    } finally {
      setLoading(false);
    }
  }, [service.id, showToast, supabase, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const saveServiceDetails = async () => {
    const name = serviceForm.name.trim();
    if (!name) {
      showToast('Service name is required', 'error');
      return;
    }
    const price = Number(serviceForm.base_price);
    if (!serviceForm.base_price || Number.isNaN(price) || price <= 0) {
      showToast('Enter a valid price', 'error');
      return;
    }
    const duration = Number(serviceForm.duration_minutes);
    if (!serviceForm.duration_minutes || Number.isNaN(duration) || duration <= 0) {
      showToast('Enter a valid duration', 'error');
      return;
    }
    setSavingService(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({
          name,
          description: serviceForm.description.trim() || null,
          base_price: price,
          duration_minutes: duration,
        })
        .eq('id', service.id);
      if (error) throw error;
      showToast('Service details saved', 'success');
      onServiceUpdate?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save service details', 'error');
    } finally {
      setSavingService(false);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const operatingDays = settingsForm.operating_days && settingsForm.operating_days.length > 0
        ? [...new Set(settingsForm.operating_days)].sort((a, b) => a - b)
        : [0, 1, 2, 3, 4, 5, 6];
      const { error } = await supabase.from('pilates_settings').upsert(
        {
          owner_id: user.id,
          service_id: service.id,
          default_capacity: Number(settingsForm.default_capacity),
          default_session_duration_minutes: Number(settingsForm.default_session_duration_minutes),
          buffer_minutes: Number(settingsForm.buffer_minutes),
          equipment_provided: settingsForm.equipment_provided,
          require_health_declaration: settingsForm.require_health_declaration,
          default_level: settingsForm.default_level,
          equipment_notes: settingsForm.equipment_notes.trim() || null,
          location_notes: settingsForm.location_notes.trim() || null,
          operating_days: operatingDays,
        },
        { onConflict: 'service_id' }
      );
      if (error) throw error;
      showToast('Pilates details saved', 'success');
      onServiceUpdate?.();
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save Pilates details', 'error');
    } finally {
      setSaving(false);
    }
  };

  const createHost = async () => {
    if (!user?.id) return;
    const selectedProfile = hostProfiles.find((profile) => profile.id === selectedProfileId);
    const displayName = selectedProfile?.full_name || hostName.trim();
    if (!displayName) {
      showToast('Enter a host name or choose a profile', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('pilates_hosts').insert({
        owner_id: user.id,
        profile_id: selectedProfile?.id || null,
        display_name: displayName,
      });
      if (error) throw error;
      setSelectedProfileId('');
      setHostName('');
      showToast('Host added', 'success');
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add host', 'error');
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    if (!user?.id) return;
    if (!templateForm.host_id) {
      showToast('Choose a host for this class slot', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: TablesInsert<'pilates_schedule_templates'> = {
        owner_id: user.id,
        service_id: service.id,
        host_id: templateForm.host_id,
        day_of_week: Number(templateForm.day_of_week),
        start_time: templateForm.start_time,
        capacity: Number(templateForm.capacity),
        duration_minutes: Number(templateForm.duration_minutes),
        level: templateForm.level,
        starts_on: templateForm.starts_on || todayDate(),
        notes: templateForm.notes.trim() || null,
        is_active: true,
      };
      const { error } = await supabase.from('pilates_schedule_templates').insert(payload);
      if (error) throw error;
      showToast('Weekly class added', 'success');
      setTemplateForm((prev) => ({ ...prev, notes: '' }));
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add class slot', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = async (template: PilatesTemplate) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pilates_schedule_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);
      if (error) throw error;
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update class slot', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openSessionEditor = (session: PilatesSession) => {
    setEditingSession(session);
    setSessionForm({
      host_id: session.host_id || '',
      capacity: String(session.capacity),
      level: session.level,
      status: session.status,
      notes: session.notes || '',
    });
  };

  const saveSession = async () => {
    if (!editingSession) return;
    const booked = bookedCount(editingSession);
    const newCapacity = Number(sessionForm.capacity);

    // Booked session protection: prevent capacity below booked count
    if (newCapacity < booked) {
      showToast(`Cannot reduce capacity below ${booked} (${booked} booking${booked === 1 ? '' : 's'} exist)`, 'error');
      return;
    }

    // Booked session protection: confirm before cancelling with active bookings
    if (sessionForm.status === 'cancelled' && editingSession.status !== 'cancelled' && booked > 0) {
      const confirmed = window.confirm(
        `This session has ${booked} active booking${booked === 1 ? '' : 's'}. Cancelling will affect ${booked === 1 ? 'this client' : 'these clients'}. Are you sure?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('pilates_class_sessions')
        .update({
          host_id: sessionForm.host_id || null,
          capacity: newCapacity,
          level: sessionForm.level,
          status: sessionForm.status,
          notes: sessionForm.notes.trim() || null,
          is_override: true,
        })
        .eq('id', editingSession.id);
      if (error) throw error;
      setEditingSession(null);
      showToast('Class updated', 'success');
      await loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update class', 'error');
    } finally {
      setSaving(false);
    }
  };

  const bookedCount = (session: PilatesSession) => session.pilates_session_bookings?.filter((booking) => booking.status === 'booked').length || 0;

  const upcomingCount = sessions.filter((s) => s.status !== 'cancelled').length;
  const activeTemplateCount = templates.filter((t) => t.is_active).length;
  const bookingCount = sessions.reduce((acc, s) => acc + (s.pilates_session_bookings?.filter((b) => b.status === 'booked').length || 0), 0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* STAT STRIP */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
            <CalendarDays size={14} /> Upcoming
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{upcomingCount}</p>
          <p className="text-[11px] text-emerald-900/70">Next 5 weeks</p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-700">
            <Clock size={14} /> Active slots
          </div>
          <p className="mt-2 text-2xl font-bold text-violet-900">{activeTemplateCount}</p>
          <p className="text-[11px] text-violet-900/70">Weekly templates</p>
        </div>
        <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-pink-700">
            <Sparkles size={14} /> Bookings
          </div>
          <p className="mt-2 text-2xl font-bold text-pink-900">{bookingCount}</p>
          <p className="text-[11px] text-pink-900/70">Confirmed</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-sky-700">
            <Users size={14} /> Instructors
          </div>
          <p className="mt-2 text-2xl font-bold text-sky-900">{hosts.length}</p>
          <p className="text-[11px] text-sky-900/70">Active hosts</p>
        </div>
      </div>

      {/* TAB NAV */}
      <div className="glass-card flex gap-1 overflow-x-auto p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={active}
              className={`flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                active
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)]'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-20 text-[var(--color-text-muted)]">
          <Loader2 size={18} className="animate-spin" /> Loading timetable...
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* SCHEDULE TAB */}
          {activeTab === 'schedule' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
              {/* ADD WEEKLY CLASS */}
              <div className="rounded-3xl border border-pink-100 bg-pink-50/70 p-6">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100">
                    <Plus size={18} className="text-pink-700" />
                  </div>
                  <h3 className="font-bold text-pink-900">Add a weekly class</h3>
                </div>
                <p className="mb-5 text-xs text-pink-900/70">Recurring slot. Sessions auto-generate for the next 5 weeks.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Day</label>
                    <select value={templateForm.day_of_week} onChange={(e) => setTemplateForm({ ...templateForm, day_of_week: Number(e.target.value) })} className="input-glass">
                      {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Start time</label>
                    <input type="time" value={templateForm.start_time} onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })} className="input-glass" />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Instructor</label>
                  <select value={templateForm.host_id} onChange={(e) => setTemplateForm({ ...templateForm, host_id: e.target.value })} className="input-glass">
                    <option value="">— Choose instructor —</option>
                    {hosts.map((host) => <option key={host.id} value={host.id}>{host.display_name}</option>)}
                  </select>
                  {hosts.length === 0 && <p className="mt-1 text-[10px] text-pink-900/70">Add an instructor in the Instructors tab first.</p>}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Spaces</label>
                    <input type="number" min="1" max="50" value={templateForm.capacity} onChange={(e) => setTemplateForm({ ...templateForm, capacity: e.target.value })} className="input-glass" placeholder="6" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Minutes</label>
                    <input type="number" min="15" max="240" value={templateForm.duration_minutes} onChange={(e) => setTemplateForm({ ...templateForm, duration_minutes: e.target.value })} className="input-glass" placeholder="50" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Level</label>
                    <select value={templateForm.level} onChange={(e) => setTemplateForm({ ...templateForm, level: e.target.value })} className="input-glass">
                      {LEVELS.map((level) => <option key={level}>{level}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Starts on</label>
                  <input type="date" value={templateForm.starts_on} min={todayDate()} onChange={(e) => setTemplateForm({ ...templateForm, starts_on: e.target.value })} className="input-glass" />
                  <p className="mt-1 text-[10px] text-pink-900/70">First date this class runs from</p>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-pink-900/80">Notes (optional)</label>
                  <textarea value={templateForm.notes} onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })} rows={2} className="input-glass resize-none" placeholder="e.g. Focus on core strength. Suitable for postnatal recovery." />
                </div>

                <button onClick={createTemplate} disabled={saving} className="btn-primary mt-5 w-full py-2.5 text-sm">{saving ? 'Adding…' : 'Add to weekly timetable'}</button>
              </div>

              {/* WEEKLY TIMETABLE LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]"><CalendarDays size={18} /> Weekly timetable</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">{templates.length} slot{templates.length === 1 ? '' : 's'}</span>
                </div>
                {templates.length === 0 ? (
                  <div className="glass-card flex flex-col items-center justify-center gap-3 p-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100">
                      <CalendarDays size={26} className="text-pink-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">No weekly classes yet</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add your first recurring class on the left.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {templates.map((template) => {
                      const host = hosts.find((item) => item.id === template.host_id);
                      const dayLabel = DAYS.find((day) => day.value === template.day_of_week)?.label || '';
                      return (
                        <div key={template.id} className={`rounded-2xl border p-4 transition-all ${template.is_active ? 'border-emerald-100 bg-white shadow-sm' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">{dayLabel} · {template.start_time.slice(0, 5)}</p>
                              <p className="mt-1 truncate font-bold text-[var(--color-text-primary)]">{host?.display_name || 'No host'}</p>
                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{template.level} · {template.capacity} spots · {template.duration_minutes} min</p>
                            </div>
                            <button
                              onClick={() => toggleTemplate(template)}
                              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all ${template.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                            >
                              {template.is_active ? 'Active' : 'Paused'}
                            </button>
                          </div>
                          {template.notes && <p className="mt-3 rounded-xl bg-[var(--color-surface-light)] p-2 text-[11px] italic text-[var(--color-text-secondary)]">{template.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]"><Clock size={18} /> Upcoming sessions</h3>
                <span className="text-xs text-[var(--color-text-muted)]">Tap a session to override</span>
              </div>
              {sessions.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
                    <Clock size={26} className="text-violet-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">No upcoming sessions</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add a weekly class in the Schedule tab to start generating sessions.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sessions.map((session) => {
                    const count = bookedCount(session);
                    const full = count >= session.capacity;
                    const cancelled = session.status === 'cancelled';
                    const startsAt = new Date(session.starts_at);
                    const dateLabel = startsAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={session.id}
                        onClick={() => openSessionEditor(session)}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${cancelled ? 'border-red-100 bg-red-50' : full ? 'border-amber-100 bg-amber-50/60' : 'border-emerald-100 bg-white'}`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{dateLabel}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-xl font-bold text-[var(--color-text-primary)]">{startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${cancelled ? 'bg-red-100 text-red-700' : full ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                            {count}/{session.capacity}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-violet-700">{session.host?.display_name || 'No host'}</p>
                        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                          {session.level}
                          {cancelled && ' · cancelled'}
                          {!cancelled && full && ' · full'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* INSTRUCTORS TAB */}
          {activeTab === 'instructors' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
              <div className="rounded-3xl border border-sky-100 bg-sky-50/60 p-6">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
                    <UserPlus size={18} className="text-sky-700" />
                  </div>
                  <h3 className="font-bold text-sky-900">Add an instructor</h3>
                </div>
                <p className="mb-5 text-xs text-sky-900/70">Pick from your team or add an external host by name.</p>

                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">From your team</label>
                <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className="input-glass">
                  <option value="">— Select a team member —</option>
                  {hostProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || 'Unnamed'} · {profile.role}</option>)}
                </select>

                {!selectedProfileId && (
                  <div className="mt-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">Or external instructor</label>
                    <input value={hostName} onChange={(e) => setHostName(e.target.value)} className="input-glass" placeholder="e.g. Sarah Thompson" />
                    <p className="mt-1 text-[10px] text-sky-900/70">Use this for instructors who aren&apos;t on your team yet.</p>
                  </div>
                )}

                <button onClick={createHost} disabled={saving} className="btn-primary mt-5 w-full py-2.5 text-sm">{saving ? 'Adding…' : 'Add instructor'}</button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]"><Users size={18} /> Roster</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">{hosts.length} instructor{hosts.length === 1 ? '' : 's'}</span>
                </div>
                {hosts.length === 0 ? (
                  <div className="glass-card flex flex-col items-center justify-center gap-3 p-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
                      <Users size={26} className="text-sky-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">No instructors yet</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add your first host on the left.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {hosts.map((host) => (
                      <div key={host.id} className="glass-card flex items-center gap-3 p-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold">
                          {(host.display_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-bold text-[var(--color-text-primary)]">{host.display_name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{host.profile_id ? 'Team member' : 'External instructor'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* SERVICE DETAILS */}
              <div className="rounded-3xl border border-sky-100 bg-sky-50/60 p-6">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
                    <Scissors size={18} className="text-sky-700" />
                  </div>
                  <h3 className="font-bold text-sky-900">Service details</h3>
                </div>
                <p className="mb-5 text-xs text-sky-900/70">Shown to clients on the booking page and in the services list.</p>

                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">Name</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="input-glass"
                  placeholder="e.g. Pilates Studio"
                />

                <label className="mb-1 mt-3 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={3}
                  className="input-glass resize-none"
                  placeholder="What this Pilates service offers…"
                />

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">Price (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={serviceForm.base_price}
                      onChange={(e) => setServiceForm({ ...serviceForm, base_price: e.target.value })}
                      className="input-glass"
                      placeholder="25"
                    />
                    <p className="mt-1 text-[10px] text-sky-900/60">Base price per class</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-sky-900/80">Duration (min)</label>
                    <input
                      type="number"
                      min="1"
                      value={serviceForm.duration_minutes}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })}
                      className="input-glass"
                      placeholder="50"
                    />
                    <p className="mt-1 text-[10px] text-sky-900/60">Displayed length per class</p>
                  </div>
                </div>

                <button
                  onClick={saveServiceDetails}
                  disabled={savingService}
                  className="btn-primary mt-5 w-full py-2.5 text-sm"
                >
                  {savingService ? 'Saving…' : 'Save service details'}
                </button>
              </div>

              {/* DEFAULT CLASS SETTINGS */}
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
                <div className="mb-1 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                    <Save size={18} className="text-emerald-700" />
                  </div>
                  <h3 className="font-bold text-emerald-900">Default class settings</h3>
                </div>
                <p className="mb-5 text-xs text-emerald-900/70">These defaults are used when generating new weekly classes.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-emerald-900/80">Default capacity</label>
                    <input type="number" min="1" max="50" value={settingsForm.default_capacity} onChange={(e) => setSettingsForm({ ...settingsForm, default_capacity: Number(e.target.value) })} className="input-glass" placeholder="e.g. 6" />
                    <p className="mt-1 text-[10px] text-emerald-900/60">Max clients per class</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-emerald-900/80">Session length</label>
                    <input type="number" min="15" max="240" value={settingsForm.default_session_duration_minutes} onChange={(e) => setSettingsForm({ ...settingsForm, default_session_duration_minutes: Number(e.target.value) })} className="input-glass" placeholder="e.g. 50" />
                    <p className="mt-1 text-[10px] text-emerald-900/60">Length in minutes</p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-emerald-900/80">Default level</label>
                  <select value={settingsForm.default_level} onChange={(e) => setSettingsForm({ ...settingsForm, default_level: e.target.value })} className="input-glass">
                    {LEVELS.map((level) => <option key={level}>{level}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-emerald-900/60">Skill level shown to clients on booking</p>
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-emerald-900/80">Operating days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map((day) => {
                      const isOn = settingsForm.operating_days.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const current = new Set(settingsForm.operating_days);
                            if (current.has(day.value)) {
                              if (current.size === 1) return;
                              current.delete(day.value);
                            } else {
                              current.add(day.value);
                            }
                            setSettingsForm({ ...settingsForm, operating_days: [...current].sort((a, b) => a - b) });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                            isOn
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white text-[var(--color-text-muted)] border-emerald-200 hover:border-emerald-400'
                          }`}
                          aria-pressed={isOn}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 flex items-start gap-1 text-[10px] text-emerald-900/60">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    <span>Tap to toggle. Days marked off won&apos;t generate new classes. Existing classes with bookings are kept.</span>
                  </p>
                </div>

                <div className="mt-3">
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-900/80"><Sparkles size={11} /> Equipment notes</label>
                  <textarea value={settingsForm.equipment_notes} onChange={(e) => setSettingsForm({ ...settingsForm, equipment_notes: e.target.value })} rows={2} className="input-glass resize-none" placeholder="e.g. We provide mats and reformers. Bring grip socks." />
                  <p className="mt-1 text-[10px] text-emerald-900/60">What clients need to bring or wear</p>
                </div>

                <div className="mt-3">
                  <label className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-900/80"><MapPin size={11} /> Location notes</label>
                  <textarea value={settingsForm.location_notes} onChange={(e) => setSettingsForm({ ...settingsForm, location_notes: e.target.value })} rows={2} className="input-glass resize-none" placeholder="e.g. 2nd floor. Use the side entrance. Parking on Oxford St." />
                  <p className="mt-1 text-[10px] text-emerald-900/60">Address, parking, entry instructions</p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-white/70 p-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                    <input type="checkbox" checked={settingsForm.equipment_provided} onChange={(e) => setSettingsForm({ ...settingsForm, equipment_provided: e.target.checked })} className="mt-0.5" />
                    <span>
                      Equipment provided
                      <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">Studio supplies the gear</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-white/70 p-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                    <input type="checkbox" checked={settingsForm.require_health_declaration} onChange={(e) => setSettingsForm({ ...settingsForm, require_health_declaration: e.target.checked })} className="mt-0.5" />
                    <span>
                      Require health declaration
                      <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">Clients confirm fitness to attend</span>
                    </span>
                  </label>
                </div>

                <button onClick={saveSettings} disabled={saving} className="btn-primary mt-5 w-full py-2.5 text-sm">{saving ? 'Saving…' : 'Save default settings'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {editingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Edit class</p>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{new Date(editingSession.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</h3>
              </div>
              <button onClick={() => setEditingSession(null)} aria-label="Close class editor"><X size={18} /></button>
            </div>
            <p className="-mt-2 mb-3 text-xs text-[var(--color-text-muted)]">
              Override the defaults for this single class. Changes only affect this date and time.
            </p>
            {bookedCount(editingSession) > 0 && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-amber-800">Protected session — {bookedCount(editingSession)} active booking{bookedCount(editingSession) === 1 ? '' : 's'}</p>
                  <p className="mt-0.5 text-[11px] text-amber-700/80">Capacity cannot be reduced below {bookedCount(editingSession)}. Cancelling will notify affected clients.</p>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Instructor</label>
                <select value={sessionForm.host_id} onChange={(e) => setSessionForm({ ...sessionForm, host_id: e.target.value })} className="input-glass">
                  <option value="">— No instructor —</option>
                  {hosts.map((host) => <option key={host.id} value={host.id}>{host.display_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Spaces</label>
                  <input type="number" min={Math.max(1, bookedCount(editingSession))} max="50" value={sessionForm.capacity} onChange={(e) => setSessionForm({ ...sessionForm, capacity: e.target.value })} className="input-glass" placeholder="e.g. 6" />
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    Max clients for this class only
                    {bookedCount(editingSession) > 0 && <span className="ml-1 font-semibold text-amber-600">(min {bookedCount(editingSession)} — booked)</span>}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Level</label>
                  <select value={sessionForm.level} onChange={(e) => setSessionForm({ ...sessionForm, level: e.target.value })} className="input-glass">
                    {LEVELS.map((level) => <option key={level}>{level}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</label>
                <select value={sessionForm.status} onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })} className="input-glass">
                  <option value="scheduled">Scheduled — class will run</option>
                  <option value="cancelled">Cancelled — clients will be notified</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Notes (optional)</label>
                <textarea value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} rows={3} className="input-glass resize-none" placeholder="e.g. Studio closed for repairs. Class moved to Room B." />
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Shown to booked clients</p>
              </div>
              <button onClick={saveSession} disabled={saving} className="btn-primary w-full py-3 text-sm">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PilatesTimetableManager;
