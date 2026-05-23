'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  Scissors, Plus, Clock, Edit3, ToggleLeft, ToggleRight, Sparkles, X, Loader2,
  Save, Trash2, AlertTriangle, Activity, CalendarDays, ChevronRight, ChevronDown,
  DollarSign, Settings2, Percent, BadgePoundSterling,
} from 'lucide-react';
import type { Tables, TablesInsert } from '@/types/database';

type Service = Tables<'services'>;
type MasterServiceRow = Tables<'master_services'>;
type ServiceInsert = TablesInsert<'services'>;

type ServiceWithConfig = Service & { config?: MasterServiceRow };

const CATEGORIES = ['Nails', 'Lashes', 'Brows', 'Hair', 'Makeup', 'Skincare', 'Pilates', 'Other'];

export default function ServicesPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const [services, setServices] = useState<ServiceWithConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = profile?.role === 'owner';
  const categories = isOwner ? CATEGORIES : CATEGORIES.filter((category) => category !== 'Pilates');

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', description: '', base_price: '', duration_minutes: '60', category: 'Nails', requires_consultation: false });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceWithConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPilatesHub, setShowPilatesHub] = useState(false);
  const [creatingDefaultPilates, setCreatingDefaultPilates] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Expanded config panel per service
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState<string | null>(null);

  // Per-service config form (custom price, duration, deposit)
  const [configForm, setConfigForm] = useState<{
    custom_price: string;
    custom_duration: string;
    deposit_override_type: string;
    deposit_override_value: string;
  }>({ custom_price: '', custom_duration: '', deposit_override_type: 'none', deposit_override_value: '' });

  const pilatesServices = services.filter((s) => s.category === 'Pilates');

  const activeCategories = ['All', ...Array.from(new Set(services.map((s) => s.category || 'Other').filter(Boolean))).sort()];
  const filteredServices = categoryFilter === 'All' ? services : services.filter((s) => (s.category || 'Other') === categoryFilter);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [{ data: svcData }, { data: cfgData }] = await Promise.all([
      supabase.from('services').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
      supabase.from('master_services').select('*').eq('master_id', user.id),
    ]);
    const merged: ServiceWithConfig[] = (svcData || []).map((s) => {
      const config = cfgData?.find((c) => c.service_id === s.id);
      return { ...s, config };
    });
    setServices(merged);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const load = async () => {
      const [{ data: svcData }, { data: cfgData }] = await Promise.all([
        supabase.from('services').select('*').eq('created_by', user.id).order('created_at', { ascending: false }),
        supabase.from('master_services').select('*').eq('master_id', user.id),
      ]);
      if (!mounted) return;
      const merged: ServiceWithConfig[] = (svcData || []).map((s) => {
        const config = cfgData?.find((c) => c.service_id === s.id);
        return { ...s, config };
      });
      setServices(merged);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Helpers ---

  const ensureConfig = async (serviceId: string): Promise<MasterServiceRow> => {
    const existing = services.find((s) => s.id === serviceId)?.config;
    if (existing) return existing;
    const { data, error } = await supabase
      .from('master_services')
      .insert({ master_id: user!.id, service_id: serviceId, is_available: true })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  // --- Toggle availability (master_services.is_available) ---

  const handleToggleAvailability = async (svc: ServiceWithConfig) => {
    const current = svc.config?.is_available ?? false;
    const newVal = !current;

    // Optimistic
    setServices((prev) =>
      prev.map((s) =>
        s.id === svc.id
          ? { ...s, config: s.config ? { ...s.config, is_available: newVal } : undefined }
          : s
      )
    );

    try {
      const cfg = await ensureConfig(svc.id);
      await supabase.from('master_services').update({ is_available: newVal }).eq('id', cfg.id);
      showToast(newVal ? 'Service enabled for booking' : 'Service disabled for booking', 'info');
      fetchAll();
    } catch {
      showToast('Failed to toggle availability', 'error');
      fetchAll();
    }
  };

  // --- Toggle global is_active ---

  const toggleService = async (id: string, current: boolean) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: !current } : s)));
    await supabase.from('services').update({ is_active: !current }).eq('id', id);
    showToast(!current ? 'Service activated' : 'Service deactivated', 'info');
  };

  // --- Config panel ---

  const openConfig = (svc: ServiceWithConfig) => {
    if (expandedId === svc.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(svc.id);
    const cfg = svc.config;
    setConfigForm({
      custom_price: cfg?.custom_price != null ? cfg.custom_price.toString() : '',
      custom_duration: cfg?.custom_duration != null ? cfg.custom_duration.toString() : '',
      deposit_override_type: cfg?.deposit_override_type || 'none',
      deposit_override_value: cfg?.deposit_override_value != null ? cfg.deposit_override_value.toString() : '',
    });
  };

  const saveConfig = async (svc: ServiceWithConfig) => {
    setConfigSaving(svc.id);
    try {
      const cfg = await ensureConfig(svc.id);
      const customPrice = configForm.custom_price.trim() ? Number(configForm.custom_price) : null;
      const customDuration = configForm.custom_duration.trim() ? Number(configForm.custom_duration) : null;
      const depType = configForm.deposit_override_type === 'none' ? null : configForm.deposit_override_type;
      const depValue = depType && configForm.deposit_override_value.trim() ? Number(configForm.deposit_override_value) : null;

      if (customPrice !== null && (isNaN(customPrice) || customPrice < 0)) {
        showToast('Invalid custom price', 'error');
        return;
      }
      if (customDuration !== null && (isNaN(customDuration) || customDuration <= 0)) {
        showToast('Invalid custom duration', 'error');
        return;
      }
      if (depValue !== null && (isNaN(depValue) || depValue < 0)) {
        showToast('Invalid deposit value', 'error');
        return;
      }

      const { error } = await supabase.from('master_services').update({
        custom_price: customPrice,
        custom_duration: customDuration,
        deposit_override_type: depType,
        deposit_override_value: depValue,
      }).eq('id', cfg.id);
      if (error) throw error;

      showToast('Configuration saved', 'success');
      fetchAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save config', 'error');
    } finally {
      setConfigSaving(null);
    }
  };

  // --- CRUD ---

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('services').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Service deleted', 'success');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete service', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: '', description: '', base_price: '', duration_minutes: '60', category: categories[0] || 'Nails', requires_consultation: false });
    setShowModal(true);
  };

  const openCreatePilates = () => {
    setEditingService(null);
    setForm({ name: 'Pilates Studio', description: 'Reformer & mat Pilates classes.', base_price: '25', duration_minutes: '50', category: 'Pilates', requires_consultation: false });
    setShowPilatesHub(false);
    setShowModal(true);
  };

  const quickCreatePilatesAndOpen = async () => {
    if (!user) return;
    setCreatingDefaultPilates(true);
    try {
      const payload: Omit<ServiceInsert, 'created_by' | 'is_active'> = {
        name: 'Pilates Studio',
        description: 'Reformer & mat Pilates classes.',
        category: 'Pilates',
        base_price: 25,
        duration_minutes: 50,
        requires_consultation: false,
      };
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .insert({ ...payload, created_by: user.id, is_active: true })
        .select()
        .single();
      if (serviceError) throw serviceError;
      await supabase.from('master_services').insert({
        master_id: user.id,
        service_id: serviceData.id,
        is_available: true,
        custom_price: null,
        custom_duration: null,
      });
      showToast('Pilates studio created!', 'success');
      await fetchAll();
      setShowPilatesHub(false);
      router.push(`/dashboard/services/pilates/${serviceData.id}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create Pilates studio', 'error');
    } finally {
      setCreatingDefaultPilates(false);
    }
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description || '',
      base_price: service.base_price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      category: service.category || 'Nails',
      requires_consultation: service.requires_consultation || false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Please enter a service name', 'error'); return; }
    if (!form.base_price || isNaN(Number(form.base_price)) || Number(form.base_price) <= 0) { showToast('Please enter a valid price', 'error'); return; }
    if (!form.duration_minutes || isNaN(Number(form.duration_minutes)) || Number(form.duration_minutes) <= 0) { showToast('Please enter a valid duration', 'error'); return; }
    if (form.category === 'Pilates' && !isOwner) { showToast('Only owners can create Pilates services', 'error'); return; }

    setSaving(true);
    try {
      const payload: Omit<ServiceInsert, 'created_by' | 'is_active'> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        base_price: Number(form.base_price),
        duration_minutes: Number(form.duration_minutes),
        requires_consultation: form.requires_consultation,
      };

      if (editingService) {
        const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
        if (error) throw error;
        showToast('Service updated!', 'success');
      } else {
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .insert({ ...payload, created_by: user!.id, is_active: true })
          .select()
          .single();
        if (serviceError) throw serviceError;

        // Link to master_services
        await supabase.from('master_services').insert({
          master_id: user!.id,
          service_id: serviceData.id,
          is_available: true,
          custom_price: null,
          custom_duration: null,
        });
        showToast('Service created!', 'success');
      }
      setShowModal(false);
      fetchAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save service', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Computed stats ---
  const availableCount = services.filter((s) => s.config?.is_available).length;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Hero Banner */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '40px', height: '220px' }}>
        <img src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=1600&q=80&auto=format&fit=crop" alt="My Services" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Scissors size={18} style={{ color: '#F9A8D4' }} />
            <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#F9A8D4', fontWeight: 700 }}>Management</span>
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0 }}>My Services</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '8px', maxWidth: '400px' }}>Manage the services you offer to clients</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Service List</h2>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setShowPilatesHub(true)}
              className="shadow-lg hover:shadow-xl flex items-center gap-2 px-5 py-2.5 text-sm cursor-pointer rounded-xl font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              title="Manage Pilates studio & timetable"
            >
              <Activity size={16} />
              Pilates
            </button>
          )}
          <button onClick={openCreate} className="btn-pink shadow-lg hover:shadow-xl flex items-center gap-2 px-5 py-2.5 text-sm cursor-pointer">
            <Plus size={16} />
            Add Service
          </button>
        </div>
      </div>

      {/* Category filter chips */}
      {services.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {activeCategories.map((cat) => {
            const count = cat === 'All' ? services.length : services.filter((s) => (s.category || 'Other') === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                  categoryFilter === cat
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                    : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{services.length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Total</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{services.filter((s) => s.is_active).length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Active</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-cyan-600">{availableCount}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Bookable</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[var(--color-text-muted)]">{services.filter((s) => !s.is_active).length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Inactive</p>
        </div>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-5 bg-[var(--color-surface-light)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--color-surface-light)] rounded w-full mb-2" />
              <div className="h-3 bg-[var(--color-surface-light)] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Sparkles size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
          <p className="text-lg font-medium text-[var(--color-text-secondary)]">No services yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Add your first service to start receiving bookings</p>
          <button onClick={openCreate} className="btn-primary mt-4 px-6 py-2.5 text-sm inline-flex items-center gap-2 cursor-pointer">
            <Plus size={16} />
            Add Your First Service
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service) => {
            const isAvailable = service.config?.is_available ?? false;
            const hasCustomPrice = service.config?.custom_price != null;
            const hasCustomDuration = service.config?.custom_duration != null;
            const hasDepositOverride = !!service.config?.deposit_override_type;
            const isExpanded = expandedId === service.id;
            const effectivePrice = hasCustomPrice ? service.config!.custom_price! : service.base_price;
            const effectiveDuration = hasCustomDuration ? service.config!.custom_duration! : service.duration_minutes;

            return (
              <div key={service.id} data-row-id={service.id} className={`glass-card transition-all duration-300 hover:shadow-lg ${!service.is_active ? 'opacity-60 grayscale-[0.3]' : 'hover:border-[var(--color-brand-pink)]/30'}`}>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{service.name}</h3>
                        {service.category && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 border border-pink-100">
                            {service.category}
                          </span>
                        )}
                        {isAvailable && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Bookable
                          </span>
                        )}
                        {service.requires_consultation && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                            Consultation
                          </span>
                        )}
                        {service.category === 'Pilates' && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Timetable
                          </span>
                        )}
                        {hasDepositOverride && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                            Custom Deposit
                          </span>
                        )}
                      </div>
                      {service.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2 max-w-2xl">{service.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-sm flex-wrap">
                        <span className="flex items-center gap-1.5 font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-light)] px-2.5 py-1 rounded-md">
                          <Clock size={14} className="text-[var(--color-info)]" />
                          {effectiveDuration} min
                          {hasCustomDuration && <span className="text-[10px] text-cyan-600 ml-1">(custom)</span>}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-[var(--color-text-primary)] bg-emerald-50 px-2.5 py-1 rounded-md text-emerald-700">
                          £{Number(effectivePrice).toFixed(2)}
                          {hasCustomPrice && <span className="text-[10px] text-cyan-600 ml-1">(custom)</span>}
                        </span>
                        {hasCustomPrice && (
                          <span className="text-xs text-[var(--color-text-muted)] line-through">
                            £{Number(service.base_price).toFixed(2)} base
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center bg-[var(--color-surface-light)] p-2 rounded-xl border border-[var(--color-border-light)]">
                      <button
                        onClick={() => openConfig(service)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer ${isExpanded ? 'text-cyan-600 bg-white shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
                        title="Service configuration"
                      >
                        <Settings2 size={18} />
                      </button>
                      {service.category !== 'Pilates' && (
                        <button
                          onClick={() => openEdit(service)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-[var(--color-text-secondary)] hover:text-cyan-600 cursor-pointer"
                          title="Edit service"
                        >
                          <Edit3 size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(service)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-[var(--color-text-secondary)] hover:text-rose-600 cursor-pointer"
                        title="Delete service"
                      >
                        <Trash2 size={18} />
                      </button>
                      {service.category === 'Pilates' && isOwner && (
                        <button
                          onClick={() => router.push(`/dashboard/services/pilates/${service.id}`)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-emerald-600 hover:text-emerald-700 cursor-pointer"
                          title="Manage Pilates timetable"
                        >
                          <Clock size={18} />
                        </button>
                      )}
                      <div className="w-[1px] h-6 bg-[var(--color-border)] opacity-60"></div>
                      <button
                        onClick={() => handleToggleAvailability(service)}
                        className="cursor-pointer w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all group"
                        title={isAvailable ? 'Disable for booking' : 'Enable for booking'}
                      >
                        {isAvailable ? (
                          <ToggleRight size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                        ) : (
                          <ToggleLeft size={24} className="text-[var(--color-text-muted)] group-hover:scale-110 transition-transform" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Config Panel */}
                {isExpanded && (
                  <div className="border-t border-[var(--color-border-light)] px-5 sm:px-6 py-5 bg-gradient-to-b from-[var(--color-surface-light)]/50 to-transparent">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings2 size={16} className="text-cyan-600" />
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Service Configuration</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {/* Custom Price */}
                      <div>
                        <label className="label-upper flex items-center gap-1.5">
                          <DollarSign size={12} className="text-emerald-600" />
                          Custom Price (£)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={configForm.custom_price}
                          onChange={(e) => setConfigForm({ ...configForm, custom_price: e.target.value })}
                          className="input-glass"
                          placeholder={`Base: £${Number(service.base_price).toFixed(2)}`}
                        />
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Leave empty to use base price</p>
                      </div>

                      {/* Custom Duration */}
                      <div>
                        <label className="label-upper flex items-center gap-1.5">
                          <Clock size={12} className="text-cyan-600" />
                          Custom Duration (min)
                        </label>
                        <input
                          type="number"
                          value={configForm.custom_duration}
                          onChange={(e) => setConfigForm({ ...configForm, custom_duration: e.target.value })}
                          className="input-glass"
                          placeholder={`Base: ${service.duration_minutes} min`}
                        />
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Leave empty to use base duration</p>
                      </div>
                    </div>

                    {/* Deposit Override */}
                    <div className="mb-4">
                      <label className="label-upper flex items-center gap-1.5 mb-2">
                        <BadgePoundSterling size={12} className="text-violet-600" />
                        Deposit Override
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(['none', 'percentage', 'fixed'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setConfigForm({ ...configForm, deposit_override_type: opt, deposit_override_value: opt === 'none' ? '' : configForm.deposit_override_value })}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                              configForm.deposit_override_type === opt
                                ? 'bg-violet-600 text-white'
                                : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]'
                            }`}
                          >
                            {opt === 'none' ? 'Use Global' : opt === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                          </button>
                        ))}
                      </div>
                      {configForm.deposit_override_type !== 'none' && (
                        <div className="max-w-xs">
                          <div className="relative">
                            <input
                              type="number"
                              step={configForm.deposit_override_type === 'percentage' ? '1' : '0.01'}
                              value={configForm.deposit_override_value}
                              onChange={(e) => setConfigForm({ ...configForm, deposit_override_value: e.target.value })}
                              className="input-glass pr-10"
                              placeholder={configForm.deposit_override_type === 'percentage' ? 'e.g. 30' : 'e.g. 15.00'}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">
                              {configForm.deposit_override_type === 'percentage' ? <Percent size={14} /> : '£'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                            {configForm.deposit_override_type === 'percentage'
                              ? 'Percentage of service price required as deposit'
                              : 'Fixed deposit amount in £'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Active/Inactive toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[var(--color-border-light)] mb-4">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Service Active (Global)</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Deactivated services are hidden from all clients</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleService(service.id, !!service.is_active)}
                        className="cursor-pointer"
                      >
                        {service.is_active ? (
                          <ToggleRight size={28} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={28} className="text-[var(--color-text-muted)]" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => saveConfig(service)}
                      disabled={configSaving === service.id}
                      className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 cursor-pointer"
                    >
                      {configSaving === service.id ? (
                        <><Loader2 size={14} className="animate-spin" /> Saving...</>
                      ) : (
                        <><Save size={14} /> Save Configuration</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{editingService ? 'Edit Service' : 'Create Service'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label-upper">Service Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-glass" placeholder="e.g., Gel Manicure" />
              </div>
              <div>
                <label className="label-upper">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-glass resize-none" rows={3} placeholder="What this service includes..." />
              </div>
              <div>
                <label className="label-upper">Category</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                        form.category === cat
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-upper">Price (£) *</label>
                  <input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="input-glass" placeholder="50" />
                </div>
                <div>
                  <label className="label-upper">Duration (min) *</label>
                  <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="input-glass" placeholder="60" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Require Consultation</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Clients must answer questions before booking</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, requires_consultation: !form.requires_consultation })}
                  className="cursor-pointer"
                >
                  {form.requires_consultation ? (
                    <ToggleRight size={28} className="text-emerald-500" />
                  ) : (
                    <ToggleLeft size={28} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
              </div>

              {/* Preview */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100">
                <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Preview</p>
                <p className="text-xs font-bold text-pink-600 uppercase tracking-wider">{form.category}</p>
                <p className="font-bold text-[var(--color-text-primary)]">{form.name || 'Service Name'}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="font-bold text-emerald-600">£{form.base_price || '0'}</span>
                  <span className="text-[var(--color-text-muted)]">{form.duration_minutes || '0'} min</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> {editingService ? 'Save Changes' : 'Create Service'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-md animate-scale-in" style={{ background: 'white' }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Delete service?</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  This will permanently remove <span className="font-semibold">{deleteTarget.name}</span>. If it has past bookings, it will be deactivated instead.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer flex items-center gap-2"
              >
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPilatesHub && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto animate-scale-in" style={{ background: 'white' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                  <Activity size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Pilates Studio</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">Manage your Pilates services, classes & timetable</p>
                </div>
              </div>
              <button onClick={() => setShowPilatesHub(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"><X size={18} /></button>
            </div>

            <div className="my-5 p-4 rounded-2xl border border-emerald-100" style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-1">How it works</p>
              <p className="text-sm text-emerald-900/80 leading-relaxed">
                Pilates services use a weekly timetable with capacity limits, hosts and recurring sessions. Create a studio service, then open its timetable to set hours, hosts and class details.
              </p>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Your Studios ({pilatesServices.length})</p>
              <button
                onClick={openCreatePilates}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer flex items-center gap-1"
              >
                <Plus size={14} /> Custom studio
              </button>
            </div>

            {pilatesServices.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200 p-8 text-center bg-emerald-50/40">
                <CalendarDays size={36} className="mx-auto text-emerald-600 mb-3" />
                <p className="font-semibold text-[var(--color-text-primary)]">No Pilates studio yet</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-4">Spin up a studio with sensible defaults and start adding classes.</p>
                <button
                  onClick={quickCreatePilatesAndOpen}
                  disabled={creatingDefaultPilates}
                  className="px-5 py-2.5 rounded-xl text-white font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                >
                  {creatingDefaultPilates ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><Plus size={16} /> Create Pilates Studio</>}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {pilatesServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      setShowPilatesHub(false);
                      router.push(`/dashboard/services/pilates/${service.id}`);
                    }}
                    className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border-light)] hover:border-emerald-300 hover:bg-emerald-50/40 transition-all cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <CalendarDays size={18} className="text-emerald-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">{service.name}</p>
                        {!service.is_active && (
                          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-surface-light)] text-[var(--color-text-muted)]">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{service.duration_minutes} min · £{service.base_price?.toFixed(2)} · Manage timetable, hosts & sessions</p>
                    </div>
                    <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  </button>
                ))}
                <button
                  onClick={quickCreatePilatesAndOpen}
                  disabled={creatingDefaultPilates}
                  className="w-full mt-2 px-5 py-3 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-emerald-700 font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {creatingDefaultPilates ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><Plus size={16} /> Add another Pilates studio</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
