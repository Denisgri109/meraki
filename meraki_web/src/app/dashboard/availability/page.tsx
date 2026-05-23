'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock, Plus, Trash2, Save, CalendarDays, Loader2,
  ChevronLeft, ChevronRight, Ban, Palmtree, X, Calendar, Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

// ─── Constants ──────────────────────────────────────────────────────
// 0=Sunday matches JS Date.getDay() and mobile convention
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first UI
const CAL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type TabId = 'schedule' | 'blocked' | 'calendar';
const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'schedule', label: 'Weekly Schedule', icon: Settings },
  { id: 'blocked', label: 'Blocked Slots', icon: Ban },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
];

// ─── Types ──────────────────────────────────────────────────────────
interface TimeSlot { start: string; end: string }
interface DaySchedule { enabled: boolean; slots: TimeSlot[] }
interface BlockedSlot {
  id: string; master_id: string; start_time: string; end_time: string;
  reason: string | null; created_at: string | null;
}
interface Appointment {
  id: string; start_time: string; end_time: string; status: string;
  service_id: string; client_id: string;
  services?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────
const buildDefault = (): Record<string, DaySchedule> =>
  Object.fromEntries(
    DISPLAY_ORDER.map(dow => [
      String(dow),
      { enabled: dow >= 1 && dow <= 5, slots: [{ start: '09:00', end: '17:00' }] },
    ])
  );

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDateDisplay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function getMonthGrid(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function genSlotLabels(sh: number, sm: number, eh: number, em: number) {
  const out: string[] = [];
  let h = sh, m = sm;
  while (h < eh || (h === eh && m < em)) {
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) { m = 0; h++; }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════
export default function AvailabilityPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('schedule');

  // ─── Weekly Schedule ────────────────────────────────────────────
  const [schedule, setSchedule] = useState(buildDefault());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Blocked Slots ──────────────────────────────────────────────
  const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockMode, setBlockMode] = useState<'single' | 'vacation'>('single');
  const [blockDate, setBlockDate] = useState(fmtDate(new Date()));
  const [blockDateEnd, setBlockDateEnd] = useState(fmtDate(new Date()));
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('17:00');
  const [blockAllDay, setBlockAllDay] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ─── Calendar ───────────────────────────────────────────────────
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  const monthDays = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ─── Load Schedule ──────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data, error } = await supabase
        .from('master_availability').select('*').eq('master_id', profile.id);
      if (error) { console.error(error); setLoading(false); return; }
      if (data && data.length > 0) {
        const s = buildDefault();
        Object.keys(s).forEach(k => { s[k] = { enabled: false, slots: [{ start: '09:00', end: '17:00' }] }; });
        data.forEach(row => {
          const key = String(row.day_of_week);
          if (!(key in s)) return;
          if (row.is_available) {
            if (!s[key].enabled) { s[key].enabled = true; s[key].slots = []; }
            s[key].slots.push({
              start: (row.start_time as string).slice(0, 5),
              end: (row.end_time as string).slice(0, 5),
            });
          } else {
            s[key].enabled = false;
          }
        });
        Object.keys(s).forEach(k => {
          if (s[k].slots.length === 0) s[k].slots = [{ start: '09:00', end: '17:00' }];
        });
        setSchedule(s);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // ─── Load Blocks ────────────────────────────────────────────────
  const loadBlocks = useCallback(async () => {
    if (!profile?.id) return;
    setBlocksLoading(true);
    // Fetch from the start of the currently viewed calendar month so that past blocks in the active month are visible on the calendar and list
    const startOfTodayOrMonth = new Date(calYear, calMonth, 1);
    const { data, error } = await supabase
      .from('blocked_slots').select('*').eq('master_id', profile.id)
      .gte('end_time', startOfTodayOrMonth.toISOString())
      .order('start_time', { ascending: true });
    if (error) console.error(error);
    setBlocks(data || []);
    setBlocksLoading(false);
  }, [profile?.id, calYear, calMonth]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // ─── Load Appointments for Calendar ─────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    setCalLoading(true);
    const start = new Date(calYear, calMonth, 1);
    const end = new Date(calYear, calMonth + 1, 0, 23, 59, 59);
    (async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, service_id, client_id, services(name), profiles!appointments_client_id_fkey(full_name)')
        .eq('master_id', profile.id)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .in('status', ['confirmed', 'pending', 'completed']);
      if (error) console.error(error);
      setAppointments((data as unknown as Appointment[]) || []);
      setCalLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, calYear, calMonth]);

  // ─── Schedule Handlers ──────────────────────────────────────────
  const toggleDay = (dow: string) =>
    setSchedule(p => ({ ...p, [dow]: { ...p[dow], enabled: !p[dow].enabled } }));
  const updateSlot = (dow: string, idx: number, field: 'start' | 'end', v: string) =>
    setSchedule(p => ({ ...p, [dow]: { ...p[dow], slots: p[dow].slots.map((s, i) => (i === idx ? { ...s, [field]: v } : s)) } }));
  const addSlot = (dow: string) =>
    setSchedule(p => ({ ...p, [dow]: { ...p[dow], slots: [...p[dow].slots, { start: '12:00', end: '17:00' }] } }));
  const removeSlot = (dow: string, idx: number) =>
    setSchedule(p => ({ ...p, [dow]: { ...p[dow], slots: p[dow].slots.filter((_, i) => i !== idx) } }));

  const handleSaveSchedule = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await supabase.from('master_availability').delete().eq('master_id', profile.id);
      const inserts: { master_id: string; day_of_week: number; start_time: string; end_time: string; is_available: boolean }[] = [];
      for (const dow of DISPLAY_ORDER) {
        const d = schedule[String(dow)];
        if (d.enabled && d.slots.length > 0) {
          for (const slot of d.slots) {
            if (slot.start >= slot.end) {
              showToast(`${DAY_LABELS[dow]}: End time must be after start`, 'error');
              setSaving(false); return;
            }
            inserts.push({ master_id: profile.id, day_of_week: dow, start_time: `${slot.start}:00`, end_time: `${slot.end}:00`, is_available: true });
          }
        } else {
          inserts.push({ master_id: profile.id, day_of_week: dow, start_time: '09:00:00', end_time: '18:00:00', is_available: false });
        }
      }
      const { error } = await supabase.from('master_availability').insert(inserts);
      if (error) throw error;
      showToast('Schedule saved successfully', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally { setSaving(false); }
  };

  // ─── Block Handlers ─────────────────────────────────────────────
  const handleAddBlock = async () => {
    if (!profile?.id) return;
    if (!blockReason.trim()) { showToast('Please enter a reason', 'error'); return; }
    setBlockSubmitting(true);
    try {
      let startStr: string, endStr: string;
      if (blockMode === 'single') {
        startStr = blockAllDay ? `${blockDate}T00:00:00` : `${blockDate}T${blockStartTime}:00`;
        endStr = blockAllDay ? `${blockDate}T23:59:59` : `${blockDate}T${blockEndTime}:00`;
        if (!blockAllDay && blockStartTime >= blockEndTime) { showToast('End time must be after start', 'error'); setBlockSubmitting(false); return; }
      } else {
        if (blockDateEnd < blockDate) { showToast('End date must be on or after start date', 'error'); setBlockSubmitting(false); return; }
        startStr = blockAllDay ? `${blockDate}T00:00:00` : `${blockDate}T${blockStartTime}:00`;
        endStr = blockAllDay ? `${blockDateEnd}T23:59:59` : `${blockDateEnd}T${blockEndTime}:00`;
      }
      const { error } = await supabase.from('blocked_slots').insert({
        master_id: profile.id,
        start_time: new Date(startStr).toISOString(),
        end_time: new Date(endStr).toISOString(),
        reason: blockReason.trim(),
      });
      if (error) throw error;
      showToast('Time blocked successfully', 'success');
      setShowBlockModal(false); setBlockReason(''); setBlockAllDay(false); setBlockMode('single');
      loadBlocks();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to block time', 'error');
    } finally { setBlockSubmitting(false); }
  };

  const handleDeleteBlock = async (id: string) => {
    const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
    if (!error) { setBlocks(p => p.filter(b => b.id !== id)); showToast('Block removed', 'success'); }
    setConfirmDeleteId(null);
  };

  // ─── Calendar Helpers ───────────────────────────────────────────
  const getAptsForDay = (d: Date) => { const ds = fmtDate(d); return appointments.filter(a => a.start_time.slice(0, 10) === ds); };
  const getBlocksForDay = (d: Date) => {
    const s = new Date(d); s.setHours(0, 0, 0, 0);
    const e = new Date(d); e.setHours(23, 59, 59, 999);
    return blocks.filter(b => new Date(b.start_time) <= e && new Date(b.end_time) >= s);
  };
  const isDayAvail = (d: Date) => schedule[String(d.getDay())]?.enabled ?? false;
  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); setSelectedDay(null); };
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); setSelectedDay(null); };

  const selDayApts = selectedDay ? getAptsForDay(selectedDay) : [];
  const selDayBlocks = selectedDay ? getBlocksForDay(selectedDay) : [];
  const selDayAvail = selectedDay ? isDayAvail(selectedDay) : false;
  const selDaySched = selectedDay ? schedule[String(selectedDay.getDay())] : null;

  const selDaySlots = useMemo(() => {
    if (!selectedDay || !selDaySched || !selDayAvail) return [];
    const result: { time: string; status: 'available' | 'booked' | 'blocked'; label?: string }[] = [];
    for (const slot of selDaySched.slots) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      for (const tl of genSlotLabels(sh, sm, eh, em)) {
        const [h, m] = tl.split(':').map(Number);
        const ss = new Date(selectedDay); ss.setHours(h, m, 0, 0);
        const blocked = selDayBlocks.find(b => ss >= new Date(b.start_time) && ss < new Date(b.end_time));
        if (blocked) { result.push({ time: tl, status: 'blocked', label: blocked.reason || 'Blocked' }); continue; }
        const booked = selDayApts.find(a => ss >= new Date(a.start_time) && ss < new Date(a.end_time));
        if (booked) {
          const cn = (booked.profiles as { full_name: string } | null)?.full_name || 'Client';
          const sn = (booked.services as { name: string } | null)?.name || 'Appointment';
          result.push({ time: tl, status: 'booked', label: `${cn} — ${sn}` }); continue;
        }
        result.push({ time: tl, status: 'available' });
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay?.toISOString(), selDaySched, selDayAvail, selDayBlocks, selDayApts]);

  // ─── Render ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center p-20">
        <Loader2 size={32} className="animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in pb-20">
      {/* ── Hero ── */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '32px', height: '200px' }}>
        <img src="https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=1600&q=80&auto=format&fit=crop" alt="Schedule" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CalendarDays size={18} style={{ color: '#67E8F9' }} />
            <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#67E8F9', fontWeight: 700 }}>Schedule</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0 }}>Schedule & Calendar</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '6px', maxWidth: '420px' }}>Manage your availability, block time off, and view your calendar.</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-8 border-b border-[var(--color-border-light)]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all cursor-pointer border-b-2 -mb-[1px] ${active ? 'text-cyan-600 border-cyan-500' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)]'}`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════ WEEKLY SCHEDULE TAB ══════════════ */}
      {activeTab === 'schedule' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Weekly Hours</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Set your standard recurring availability.</p>
            </div>
            <button onClick={handleSaveSchedule} disabled={saving} className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-3">
            {DISPLAY_ORDER.map(dow => {
              const key = String(dow);
              const ds = schedule[key];
              if (!ds) return null;
              return (
                <div key={dow} className={`glass-card overflow-hidden transition-all duration-300 ${!ds.enabled ? 'opacity-50' : 'hover:shadow-lg hover:border-[var(--color-brand-cyan)]/30'}`}>
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
                    <div className="flex items-center justify-between sm:justify-start sm:w-44 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleDay(key)}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer focus:outline-none shadow-inner border border-black/10 ${ds.enabled ? 'bg-cyan-500' : 'bg-slate-300'}`}
                        >
                          <span className="absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm" style={{ transform: ds.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                        <span className="font-semibold text-[var(--color-text-primary)]">{DAY_LABELS[dow]}</span>
                      </div>
                      {ds.enabled && (
                        <button onClick={() => addSlot(key)} className="sm:hidden text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 flex items-center gap-1 cursor-pointer">
                          <Plus size={14} /> Add
                        </button>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      {ds.enabled ? (
                        <>
                          {ds.slots.map((slot, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-light)] rounded-xl p-2 sm:p-3 border border-[var(--color-border-light)] animate-fade-in">
                              <div className="flex-1 flex items-center gap-2 sm:gap-3">
                                <div className="relative">
                                  <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                                  <input type="time" value={slot.start} onChange={e => updateSlot(key, idx, 'start', e.target.value)} className="w-[105px] bg-white border border-[var(--color-border)] rounded-lg py-1.5 pl-8 pr-2 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer" />
                                </div>
                                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">to</span>
                                <div className="relative">
                                  <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                                  <input type="time" value={slot.end} onChange={e => updateSlot(key, idx, 'end', e.target.value)} className="w-[105px] bg-white border border-[var(--color-border)] rounded-lg py-1.5 pl-8 pr-2 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer" />
                                </div>
                              </div>
                              {ds.slots.length > 1 && (
                                <button onClick={() => removeSlot(key, idx)} className="p-1.5 rounded-full hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors cursor-pointer" title="Remove">
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => addSlot(key)} className="hidden sm:flex text-sm font-medium text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg px-3 py-1.5 items-center gap-1.5 cursor-pointer transition-colors w-fit">
                            <Plus size={15} /> Add slot
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-[var(--color-text-muted)] py-2">Day off</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════ BLOCKED SLOTS TAB ══════════════ */}
      {activeTab === 'blocked' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Blocked Slots</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Block specific times or set vacation days.</p>
            </div>
            <button onClick={() => setShowBlockModal(true)} className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <Plus size={16} /> Block Time
            </button>
          </div>

          {blocksLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-cyan-500" /></div>
          ) : blocks.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Ban size={40} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-secondary)] font-medium">No blocked slots</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Block time off for lunch, personal time, or vacation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map(b => {
                const bStart = new Date(b.start_time);
                const bEnd = new Date(b.end_time);
                const isSame = fmtDate(bStart) === fmtDate(bEnd);
                const isFullDay = bStart.getHours() === 0 && bStart.getMinutes() === 0 && bEnd.getHours() === 23;
                const isVacation = !isSame;
                return (
                  <div key={b.id} className="glass-card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVacation ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                      {isVacation ? <Palmtree size={18} /> : <Ban size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--color-text-primary)] text-sm">{b.reason || 'Blocked'}</span>
                        {isVacation && <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Vacation</span>}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {isSame
                          ? `${fmtDateDisplay(b.start_time)}${isFullDay ? ' — All day' : ` · ${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}`}`
                          : `${fmtDateDisplay(b.start_time)} → ${fmtDateDisplay(b.end_time)}${isFullDay ? ' (All day)' : ` · ${fmtTime(b.start_time)} – ${fmtTime(b.end_time)}`}`}
                      </p>
                    </div>
                    {confirmDeleteId === b.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => handleDeleteBlock(b.id)} className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1.5 cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(b.id)} className="p-2 rounded-lg hover:bg-red-50 text-[var(--color-text-muted)] hover:text-red-500 transition-colors cursor-pointer shrink-0" title="Remove">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Block Modal ── */}
          {showBlockModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Block Time</h3>
                  <button onClick={() => setShowBlockModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-5">
                  <button onClick={() => setBlockMode('single')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${blockMode === 'single' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:bg-slate-50'}`}>
                    <Ban size={14} className="inline mr-1.5 -mt-0.5" /> Block Time
                  </button>
                  <button onClick={() => setBlockMode('vacation')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${blockMode === 'vacation' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-[var(--color-border-light)] text-[var(--color-text-muted)] hover:bg-slate-50'}`}>
                    <Palmtree size={14} className="inline mr-1.5 -mt-0.5" /> Vacation
                  </button>
                </div>

                {/* Reason */}
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Reason</label>
                <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  placeholder={blockMode === 'vacation' ? 'e.g. Summer holiday' : 'e.g. Lunch break, Personal'}
                  className="w-full bg-[var(--color-surface-input)] border border-[var(--color-border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 mb-4" />

                {/* Date(s) */}
                <div className={`grid gap-4 mb-4 ${blockMode === 'vacation' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{blockMode === 'vacation' ? 'Start Date' : 'Date'}</label>
                    <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} className="w-full bg-[var(--color-surface-input)] border border-[var(--color-border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer" />
                  </div>
                  {blockMode === 'vacation' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">End Date</label>
                      <input type="date" value={blockDateEnd} onChange={e => setBlockDateEnd(e.target.value)} min={blockDate} className="w-full bg-[var(--color-surface-input)] border border-[var(--color-border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer" />
                    </div>
                  )}
                </div>

                {/* All Day */}
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setBlockAllDay(!blockAllDay)} className={`relative w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer shadow-inner border border-black/10 ${blockAllDay ? 'bg-cyan-500' : 'bg-slate-300'}`}>
                    <span className="absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm" style={{ transform: blockAllDay ? 'translateX(18px)' : 'translateX(0)' }} />
                  </button>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">All day</span>
                </div>

                {/* Time */}
                {!blockAllDay && (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Start Time</label>
                      <input type="time" value={blockStartTime} onChange={e => setBlockStartTime(e.target.value)} className="w-full bg-[var(--color-surface-input)] border border-[var(--color-border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">End Time</label>
                      <input type="time" value={blockEndTime} onChange={e => setBlockEndTime(e.target.value)} className="w-full bg-[var(--color-surface-input)] border border-[var(--color-border-light)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-cyan-500/20 cursor-pointer" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button onClick={() => setShowBlockModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-slate-50 cursor-pointer transition-colors">Cancel</button>
                  <button onClick={handleAddBlock} disabled={blockSubmitting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 cursor-pointer transition-opacity disabled:opacity-50">
                    {blockSubmitting ? 'Saving...' : 'Block Time'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ CALENDAR TAB ══════════════ */}
      {activeTab === 'calendar' && (
        <div>
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"><ChevronLeft size={20} /></button>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"><ChevronRight size={20} /></button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs font-medium text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Blocked</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Day Off</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Calendar Grid */}
            <div className="flex-1">
              <div className="glass-card p-4 overflow-hidden">
                <div className="grid grid-cols-7 mb-2">
                  {CAL_HEADERS.map(h => <div key={h} className="text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider py-2">{h}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map((d, i) => {
                    if (!d) return <div key={`e-${i}`} className="aspect-square" />;
                    const today = new Date();
                    const isToday = sameDay(d, today);
                    const isSel = selectedDay && sameDay(d, selectedDay);
                    const avail = isDayAvail(d);
                    const dayApts = getAptsForDay(d);
                    const dayBlocks = getBlocksForDay(d);
                    const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => setSelectedDay(d)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium cursor-pointer transition-all relative
                          ${isSel ? 'bg-cyan-500 text-white shadow-md ring-2 ring-cyan-300' : ''}
                          ${!isSel && isToday ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200' : ''}
                          ${!isSel && !isToday && avail ? 'hover:bg-slate-50 text-[var(--color-text-primary)]' : ''}
                          ${!isSel && !isToday && !avail ? 'text-[var(--color-text-muted)] opacity-60' : ''}
                          ${isPast && !isSel ? 'opacity-40' : ''}
                        `}
                      >
                        <span>{d.getDate()}</span>
                        <div className="flex gap-0.5">
                          {avail && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/60' : 'bg-emerald-400'}`} />}
                          {dayApts.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-cyan-500'}`} />}
                          {dayBlocks.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white/80' : 'bg-red-400'}`} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Day Detail Panel */}
            <div className="lg:w-80 shrink-0">
              {selectedDay ? (
                <div className="glass-card p-5">
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                    {selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>

                  {!selDayAvail ? (
                    <p className="text-sm text-[var(--color-text-muted)] mt-3">Day off — No availability set.</p>
                  ) : (
                    <>
                      <div className="flex gap-3 mt-3 mb-4 flex-wrap">
                        <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                          {selDaySlots.filter(s => s.status === 'available').length} available
                        </span>
                        <span className="text-xs font-semibold bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-lg">
                          {selDayApts.length} booked
                        </span>
                        {selDayBlocks.length > 0 && (
                          <span className="text-xs font-semibold bg-red-50 text-red-600 px-2.5 py-1 rounded-lg">
                            {selDayBlocks.length} blocked
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                        {selDaySlots.map((slot, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                              ${slot.status === 'available' ? 'bg-emerald-50 text-emerald-700' : ''}
                              ${slot.status === 'booked' ? 'bg-cyan-50 text-cyan-700' : ''}
                              ${slot.status === 'blocked' ? 'bg-red-50 text-red-600' : ''}
                            `}
                          >
                            <span className="font-mono w-10 shrink-0">{slot.time}</span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0
                              ${slot.status === 'available' ? 'bg-emerald-400' : ''}
                              ${slot.status === 'booked' ? 'bg-cyan-500' : ''}
                              ${slot.status === 'blocked' ? 'bg-red-400' : ''}
                            `} />
                            <span className="truncate">
                              {slot.status === 'available' ? 'Available' : slot.label}
                            </span>
                          </div>
                        ))}
                        {selDaySlots.length === 0 && (
                          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No time slots for this day</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="glass-card p-8 text-center">
                  <CalendarDays size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-secondary)] font-medium">Select a day to view details</p>
                </div>
              )}
            </div>
          </div>

          {calLoading && (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-cyan-500" /></div>
          )}
        </div>
      )}
    </div>
  );
}
