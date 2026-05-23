'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import {
  Boxes, Plus, Search, AlertTriangle, TrendingDown, Package,
  X, History, Trash2, Pencil, Link2, Calculator, RefreshCw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface Supply {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  low_stock_threshold: number | null;
  cost_per_unit: number | null;
  master_id?: string;
  owner_id?: string;
  created_at?: string | null;
}

interface ConsumptionLog {
  id: string;
  supply_id: string;
  quantity_used: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string | null;
  appointment_id?: string | null;
}

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  base_price: number;
  duration_minutes: number;
  created_by: string | null;
}

interface ServiceLink {
  id: string;
  service_id: string;
  supply_id: string;
  quantity_per_service: number;
  notes: string | null;
}

const COMMON_UNITS = ['pieces', 'pairs', 'sets', 'trays', 'bottles', 'tubes', 'sheets', 'grams', 'ml'];

const emptyDraft = () => ({
  name: '',
  description: '',
  quantity: '0',
  unit: 'pieces',
  low_stock_threshold: '5',
  cost_per_unit: '',
});

type Draft = ReturnType<typeof emptyDraft>;

const fmtMoney = (v: number | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function SuppliesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const isOwner = role === 'owner';

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [serviceLinks, setServiceLinks] = useState<ServiceLink[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'inventory' | 'cost'>('inventory');

  // modals
  const [editing, setEditing] = useState<Supply | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [historyFor, setHistoryFor] = useState<Supply | null>(null);
  const [historyRows, setHistoryRows] = useState<ConsumptionLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [linkingService, setLinkingService] = useState<ServiceRow | null>(null);
  const [linkSupplyId, setLinkSupplyId] = useState<string>('');
  const [linkQty, setLinkQty] = useState<string>('1');
  const [linkNotes, setLinkNotes] = useState<string>('');

  // ─── Fetch ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supRes = isOwner
        ? await supabase
            .from('owner_supplies')
            .select('*')
            .eq('owner_id', user.id)
            .order('name')
        : await supabase
            .from('master_supplies')
            .select('*')
            .eq('master_id', user.id)
            .order('name');
      if (supRes.error) throw supRes.error;
      const supplyRows = (supRes.data as Supply[]) || [];
      setSupplies(supplyRows);

      // Services - master sees own; owner sees all active
      let svcQuery = supabase
        .from('services')
        .select('id, name, category, base_price, duration_minutes, created_by')
        .eq('is_active', true);
      if (!isOwner) svcQuery = svcQuery.eq('created_by', user.id);
      const svcRes = await svcQuery.order('name');
      if (svcRes.error) throw svcRes.error;
      const svcRows = (svcRes.data as ServiceRow[]) || [];
      setServices(svcRows);

      // Service links
      if (svcRows.length > 0) {
        const linkRes = isOwner
          ? await supabase
              .from('owner_service_supplies')
              .select('id, service_id, supply_id, quantity_per_service, notes')
              .in('service_id', svcRows.map((s) => s.id))
          : await supabase
              .from('service_supplies')
              .select('id, service_id, supply_id, quantity_per_service, notes')
              .in('service_id', svcRows.map((s) => s.id));
        if (linkRes.error) throw linkRes.error;
        setServiceLinks((linkRes.data as ServiceLink[]) || []);
      } else {
        setServiceLinks([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load supplies';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase, user, isOwner, showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Derived ─────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      supplies.filter((s) =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [supplies, search],
  );

  const lowStock = useMemo(
    () => supplies.filter((s) => s.quantity > 0 && s.quantity <= (s.low_stock_threshold ?? 5)),
    [supplies],
  );
  const outOfStock = useMemo(() => supplies.filter((s) => s.quantity === 0), [supplies]);

  const supplyById = useMemo(() => {
    const m = new Map<string, Supply>();
    supplies.forEach((s) => m.set(s.id, s));
    return m;
  }, [supplies]);

  const serviceCost = useCallback(
    (serviceId: string) => {
      const links = serviceLinks.filter((l) => l.service_id === serviceId);
      let total = 0;
      const breakdown: { name: string; cost: number; qty: number; unit: string }[] = [];
      links.forEach((l) => {
        const sup = supplyById.get(l.supply_id);
        if (!sup) return;
        const c = (Number(sup.cost_per_unit) || 0) * Number(l.quantity_per_service || 0);
        total += c;
        breakdown.push({
          name: sup.name,
          qty: Number(l.quantity_per_service),
          unit: sup.unit,
          cost: c,
        });
      });
      return { total, breakdown };
    },
    [serviceLinks, supplyById],
  );

  // ─── Handlers ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setCreating(true);
  };

  const openEdit = (s: Supply) => {
    setEditing(s);
    setCreating(false);
    setDraft({
      name: s.name,
      description: s.description ?? '',
      quantity: String(s.quantity),
      unit: s.unit,
      low_stock_threshold: s.low_stock_threshold == null ? '' : String(s.low_stock_threshold),
      cost_per_unit: s.cost_per_unit == null ? '' : String(s.cost_per_unit),
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft(null);
    setCreating(false);
  };

  const adjustQty = (delta: number) => {
    if (!draft) return;
    const cur = Number(draft.quantity) || 0;
    setDraft({ ...draft, quantity: String(Math.max(0, cur + delta)) });
  };

  const saveDraft = async () => {
    if (!draft || !user) return;
    if (!draft.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    const qty = Number(draft.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      showToast('Invalid quantity', 'error');
      return;
    }
    const unit = draft.unit.trim();
    if (!unit) {
      showToast('Unit required', 'error');
      return;
    }
    const threshold = draft.low_stock_threshold === '' ? null : Number(draft.low_stock_threshold);
    if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) {
      showToast('Invalid threshold', 'error');
      return;
    }
    const cost = draft.cost_per_unit === '' ? null : Number(draft.cost_per_unit);
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      showToast('Invalid cost', 'error');
      return;
    }

    setSaving(true);
    try {
      const base = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        quantity: qty,
        unit,
        low_stock_threshold: threshold,
        cost_per_unit: cost,
      };
      if (editing) {
        const upd = isOwner
          ? await supabase.from('owner_supplies').update(base).eq('id', editing.id)
          : await supabase.from('master_supplies').update(base).eq('id', editing.id);
        if (upd.error) throw upd.error;

        // log manual adjustment if quantity changed (master side has trigger-based logging on consumption only;
        // we manually log manual adjustments here)
        const delta = qty - editing.quantity;
        if (!isOwner && delta !== 0) {
          await supabase.from('supply_consumption_log').insert({
            supply_id: editing.id,
            quantity_used: -delta, // negative when adding stock
            quantity_before: editing.quantity,
            quantity_after: qty,
            notes: delta > 0 ? `Restock +${delta}` : `Manual remove ${Math.abs(delta)}`,
            created_by: user.id,
          });
        }
        showToast('Supply updated', 'success');
      } else {
        const ins = isOwner
          ? await supabase.from('owner_supplies').insert({ ...base, owner_id: user.id })
          : await supabase.from('master_supplies').insert({ ...base, master_id: user.id });
        if (ins.error) throw ins.error;
        showToast('Supply added', 'success');
      }
      closeEdit();
      await fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteSupply = async (s: Supply) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    try {
      const del = isOwner
        ? await supabase.from('owner_supplies').delete().eq('id', s.id)
        : await supabase.from('master_supplies').delete().eq('id', s.id);
      if (del.error) throw del.error;
      showToast('Deleted', 'success');
      setSupplies((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      showToast(msg, 'error');
    }
  };

  const openHistory = async (s: Supply) => {
    setHistoryFor(s);
    setHistoryLoading(true);
    try {
      const res = isOwner
        ? await supabase
            .from('owner_supply_consumption_log')
            .select('*')
            .eq('supply_id', s.id)
            .order('created_at', { ascending: false })
            .limit(100)
        : await supabase
            .from('supply_consumption_log')
            .select('*')
            .eq('supply_id', s.id)
            .order('created_at', { ascending: false })
            .limit(100);
      if (res.error) throw res.error;
      setHistoryRows((res.data as ConsumptionLog[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load history';
      showToast(msg, 'error');
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryFor(null);
    setHistoryRows([]);
  };

  const openLinkModal = (svc: ServiceRow) => {
    setLinkingService(svc);
    setLinkSupplyId('');
    setLinkQty('1');
    setLinkNotes('');
  };
  const closeLinkModal = () => {
    setLinkingService(null);
    setLinkSupplyId('');
  };

  const saveLink = async () => {
    if (!linkingService || !linkSupplyId) {
      showToast('Select a supply', 'error');
      return;
    }
    const qty = Number(linkQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('Invalid quantity', 'error');
      return;
    }
    setSaving(true);
    try {
      const linkPayload = {
        service_id: linkingService.id,
        supply_id: linkSupplyId,
        quantity_per_service: qty,
        notes: linkNotes.trim() || null,
      };
      const ins = isOwner
        ? await supabase.from('owner_service_supplies').insert(linkPayload)
        : await supabase.from('service_supplies').insert(linkPayload);
      const error = ins.error;
      if (error) {
        if (error.message.toLowerCase().includes('duplicate')) {
          showToast('Already linked', 'error');
        } else throw error;
      } else {
        showToast('Linked', 'success');
        closeLinkModal();
        await fetchAll();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to link';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const unlinkSupply = async (linkId: string) => {
    if (!window.confirm('Unlink this supply from the service?')) return;
    try {
      const del = isOwner
        ? await supabase.from('owner_service_supplies').delete().eq('id', linkId)
        : await supabase.from('service_supplies').delete().eq('id', linkId);
      if (del.error) throw del.error;
      setServiceLinks((prev) => prev.filter((l) => l.id !== linkId));
      showToast('Unlinked', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unlink';
      showToast(msg, 'error');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Boxes size={22} className="text-[var(--color-brand-pink-dark)]" />
            <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">Supplies</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            {isOwner
              ? 'Platform-wide private supplies. Track stock, costs, and per-service usage.'
              : 'Track your salon supplies. Auto-deducts when appointments complete.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer text-[var(--color-text-secondary)]"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm cursor-pointer"
          >
            <Plus size={16} />
            Add Supply
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border-light)]">
        {(['inventory', 'cost'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-[var(--color-brand-pink-dark)] text-[var(--color-brand-pink-dark)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t === 'inventory' ? 'Inventory' : 'Service Costs'}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          {/* Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Package size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{supplies.length}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Total Supplies</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <TrendingDown size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-600">{lowStock.length}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Low Stock</p>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{outOfStock.length}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Out of Stock</p>
              </div>
            </div>
          </div>

          {(lowStock.length > 0 || outOfStock.length > 0) && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Stock alert</p>
                <p>
                  {outOfStock.length > 0 && `${outOfStock.length} out of stock`}
                  {outOfStock.length > 0 && lowStock.length > 0 && ' • '}
                  {lowStock.length > 0 && `${lowStock.length} running low`}
                </p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-6">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Search supplies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-glass pl-11"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="glass-card overflow-hidden">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 border-b border-[var(--color-border-light)] animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-surface-light)]" />
                  <div className="flex-1">
                    <div className="h-4 bg-[var(--color-surface-light)] rounded w-1/3 mb-2" />
                    <div className="h-3 bg-[var(--color-surface-light)] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <Boxes size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
              <p className="text-lg font-medium text-[var(--color-text-secondary)] mb-2">No supplies yet</p>
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Add your first supply to start tracking stock.
              </p>
              <button onClick={openCreate} className="btn-primary px-5 py-2 text-sm cursor-pointer">
                <Plus size={14} className="inline mr-1" /> Add Supply
              </button>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-light)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                <div className="col-span-4">Supply</div>
                <div className="col-span-2 text-right">Quantity</div>
                <div className="col-span-2 text-right">Threshold</div>
                <div className="col-span-2 text-right">Cost / unit</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {filtered.map((s) => {
                const threshold = s.low_stock_threshold ?? 5;
                const status =
                  s.quantity === 0
                    ? { label: 'Out', cls: 'text-red-500' }
                    : s.quantity <= threshold
                    ? { label: 'Low', cls: 'text-amber-500' }
                    : { label: '', cls: 'text-[var(--color-text-primary)]' };
                return (
                  <div
                    key={s.id}
                    data-row-id={s.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)]/50 transition-colors items-center"
                  >
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-brand-pink-light)] flex items-center justify-center shrink-0">
                        <Boxes size={16} className="text-[var(--color-brand-pink-dark)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">{s.name}</p>
                        {s.description && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate">{s.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-sm font-bold ${status.cls}`}>
                        {s.quantity} {s.unit}
                      </span>
                      {status.label && (
                        <span className={`block text-[10px] uppercase font-bold ${status.cls}`}>{status.label}</span>
                      )}
                    </div>
                    <div className="col-span-2 text-right text-sm text-[var(--color-text-secondary)]">
                      {threshold} {s.unit}
                    </div>
                    <div className="col-span-2 text-right text-sm text-[var(--color-text-secondary)]">
                      {s.cost_per_unit != null ? `£${fmtMoney(s.cost_per_unit)}` : '—'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={() => openHistory(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer text-[var(--color-text-secondary)]"
                        title="History"
                      >
                        <History size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer text-[var(--color-text-secondary)]"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => deleteSupply(s)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer text-red-500"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'cost' && (
        <div>
          <div className="mb-6 p-4 rounded-2xl bg-[var(--color-brand-pink-light)]/40 flex items-start gap-3">
            <Calculator size={18} className="text-[var(--color-brand-pink-dark)] mt-0.5 shrink-0" />
            <div className="text-sm text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">Per-service supply cost</p>
              <p>
                Link supplies to services so the system can auto-deduct stock when an appointment completes
                and calculate true service cost from supply costs.
              </p>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="glass-card p-16 text-center">
              <Package size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
              <p className="text-lg font-medium text-[var(--color-text-secondary)]">No services found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((svc) => {
                const cost = serviceCost(svc.id);
                const margin = svc.base_price - cost.total;
                const links = serviceLinks.filter((l) => l.service_id === svc.id);
                return (
                  <div key={svc.id} className="glass-card p-5">
                    <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                          {svc.category || 'Service'}
                        </p>
                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{svc.name}</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          £{fmtMoney(svc.base_price)} • {svc.duration_minutes} min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Supply cost</p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">£{fmtMoney(cost.total)}</p>
                        <p className={`text-xs ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          Margin £{fmtMoney(margin)}
                        </p>
                      </div>
                      <button
                        onClick={() => openLinkModal(svc)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-brand-pink)] text-white text-xs font-semibold hover:bg-[var(--color-brand-pink-dark)] cursor-pointer"
                      >
                        <Link2 size={14} /> Link Supply
                      </button>
                    </div>

                    {links.length > 0 ? (
                      <div className="border-t border-[var(--color-border-light)] pt-3 space-y-2">
                        {links.map((l) => {
                          const sup = supplyById.get(l.supply_id);
                          if (!sup) return null;
                          const lineCost = (Number(sup.cost_per_unit) || 0) * Number(l.quantity_per_service);
                          return (
                            <div
                              key={l.id}
                              className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--color-surface-light)]"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                  {sup.name}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {l.quantity_per_service} {sup.unit}
                                  {sup.cost_per_unit != null && ` • £${fmtMoney(lineCost)}`}
                                  {l.notes && ` • ${l.notes}`}
                                </p>
                              </div>
                              <button
                                onClick={() => unlinkSupply(l.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 cursor-pointer text-red-500"
                                title="Unlink"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)] italic">
                        No supplies linked. Click &quot;Link Supply&quot; to start tracking usage.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit/Create Modal */}
      {(creating || editing) && draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeEdit}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                {editing ? 'Edit Supply' : 'Add Supply'}
              </h2>
              <button
                onClick={closeEdit}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Name *
                </label>
                <input
                  className="input-glass"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Classic Lash Trays"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Description
                </label>
                <input
                  className="input-glass"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="e.g. 0.15mm C curl, 8-14mm mixed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Quantity *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustQty(-1)}
                    className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] cursor-pointer flex items-center justify-center text-lg"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input-glass text-center font-semibold"
                    value={draft.quantity}
                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => adjustQty(1)}
                    className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] cursor-pointer flex items-center justify-center text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  Unit *
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_UNITS.map((u) => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setDraft({ ...draft, unit: u })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        draft.unit === u
                          ? 'bg-[var(--color-brand-pink-dark)] text-white'
                          : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-pink-light)]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <input
                  className="input-glass"
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="Or enter custom unit"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                    Low stock at
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input-glass"
                    value={draft.low_stock_threshold}
                    onChange={(e) => setDraft({ ...draft, low_stock_threshold: e.target.value })}
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                    Cost / unit (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-glass"
                    value={draft.cost_per_unit}
                    onChange={(e) => setDraft({ ...draft, cost_per_unit: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={closeEdit}
                className="px-4 py-2 rounded-full text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="btn-primary px-5 py-2 text-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeHistory}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{historyFor.name}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">Usage history (last 100)</p>
              </div>
              <button
                onClick={closeHistory}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            {historyLoading ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">Loading…</div>
            ) : historyRows.length === 0 ? (
              <div className="py-12 text-center">
                <History size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyRows.map((row) => {
                  const used = Number(row.quantity_used);
                  const isAdd = used < 0;
                  return (
                    <div
                      key={row.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[var(--color-surface-light)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            isAdd ? 'text-emerald-600' : 'text-[var(--color-text-primary)]'
                          }`}
                        >
                          {isAdd ? `+${Math.abs(used)}` : `−${used}`} {historyFor.unit}
                        </p>
                        {row.notes && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{row.notes}</p>
                        )}
                        {row.appointment_id && (
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                            Appointment auto-deduct
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[var(--color-text-muted)]">{fmtDate(row.created_at)}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {row.quantity_before} → {row.quantity_after}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link supply modal */}
      {linkingService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeLinkModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Link supply to</p>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] truncate">
                  {linkingService.name}
                </h2>
              </div>
              <button
                onClick={closeLinkModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const linkedIds = new Set(
                serviceLinks.filter((l) => l.service_id === linkingService.id).map((l) => l.supply_id),
              );
              const available = supplies.filter((s) => !linkedIds.has(s.id));
              if (available.length === 0) {
                return (
                  <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                    All supplies already linked. Add new supplies first.
                  </p>
                );
              }
              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                      Supply
                    </label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {available.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setLinkSupplyId(s.id)}
                          className={`w-full text-left p-3 rounded-lg cursor-pointer transition-colors ${
                            linkSupplyId === s.id
                              ? 'bg-[var(--color-brand-pink-dark)] text-white'
                              : 'bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)]'
                          }`}
                        >
                          <p className="text-sm font-medium">{s.name}</p>
                          <p
                            className={`text-xs ${
                              linkSupplyId === s.id ? 'text-white/80' : 'text-[var(--color-text-muted)]'
                            }`}
                          >
                            {s.quantity} {s.unit} available
                            {s.cost_per_unit != null && ` • £${fmtMoney(s.cost_per_unit)}/${s.unit}`}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {linkSupplyId && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                          Quantity per service
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-glass"
                          value={linkQty}
                          onChange={(e) => setLinkQty(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                          Notes (optional)
                        </label>
                        <input
                          className="input-glass"
                          value={linkNotes}
                          onChange={(e) => setLinkNotes(e.target.value)}
                          placeholder="e.g. 1 tray for full set"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={closeLinkModal}
                      className="px-4 py-2 rounded-full text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveLink}
                      disabled={saving || !linkSupplyId}
                      className="btn-primary px-5 py-2 text-sm cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Linking…' : 'Link Supply'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
