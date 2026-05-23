'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  Mail,
  Phone,
  Percent,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { Portfolio } from '@/types/database';

interface MasterProfile {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  years_of_experience: number | null;
  specialties: string[] | null;
  commission_rate: number | null;
  is_master: boolean;
  master_status: string | null;
  email: string | null;
  phone: string | null;
}

interface MasterServiceRow {
  custom_price: number | null;
  custom_duration: number | null;
  service: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    base_price: number;
    duration_minutes: number;
    is_active: boolean;
  };
}

interface DisplayService {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  duration_minutes: number;
}

export default function MasterPublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { profile: currentProfile, role } = useAuth();
  const { showToast } = useToast();
  const masterId = params.id as string;

  const [master, setMaster] = useState<MasterProfile | null>(null);
  const [services, setServices] = useState<DisplayService[]>([]);
  const [portfolioImages, setPortfolioImages] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Owner edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', commission_rate: '', specialties: '', city: '', country: '' });
  const [editSaving, setEditSaving] = useState(false);

  const isOwnProfile = currentProfile?.id === masterId;
  const isOwner = role === 'owner';

  useEffect(() => {
    if (!masterId) return;
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch master profile
        const { data: masterData } = await supabase
          .from('profiles')
          .select('id, full_name, bio, avatar_url, city, country, years_of_experience, specialties, commission_rate, is_master, master_status, email, phone')
          .eq('id', masterId)
          .single();

        // Fetch services via master_services join
        const { data: msData } = await supabase
          .from('master_services')
          .select(`
            custom_price,
            custom_duration,
            service:services (
              id, name, description, category, base_price, duration_minutes, is_active
            )
          `)
          .eq('master_id', masterId)
          .eq('is_available', true);

        // Fetch portfolio
        const { data: portfolioData } = await supabase
          .from('portfolios')
          .select('*')
          .eq('master_id', masterId)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        setMaster(masterData as MasterProfile | null);

        const formatted = ((msData as unknown as MasterServiceRow[]) || [])
          .filter((row) => row.service && row.service.is_active)
          .map((row) => ({
            id: row.service.id,
            name: row.service.name,
            description: row.service.description,
            category: row.service.category,
            base_price: row.custom_price ?? row.service.base_price,
            duration_minutes: row.custom_duration ?? row.service.duration_minutes,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setServices(formatted);

        setPortfolioImages(portfolioData || []);
      } catch (err) {
        console.error('Error loading master profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [masterId, supabase]);

  const openEdit = () => {
    if (!master) return;
    setEditForm({
      bio: master.bio || '',
      commission_rate: master.commission_rate != null ? String(master.commission_rate) : '',
      specialties: (master.specialties || []).join(', '),
      city: master.city || '',
      country: master.country || '',
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!master) return;
    setEditSaving(true);
    try {
      const commRate = editForm.commission_rate.trim() ? Number(editForm.commission_rate) : null;
      if (commRate !== null && (isNaN(commRate) || commRate < 0 || commRate > 100)) {
        showToast('Commission rate must be 0–100', 'error');
        setEditSaving(false);
        return;
      }
      const specs = editForm.specialties
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from('profiles')
        .update({
          bio: editForm.bio.trim() || null,
          commission_rate: commRate,
          specialties: specs.length > 0 ? specs : null,
          city: editForm.city.trim() || null,
          country: editForm.country.trim() || null,
        })
        .eq('id', master.id);
      if (error) throw error;

      setMaster({
        ...master,
        bio: editForm.bio.trim() || null,
        commission_rate: commRate,
        specialties: specs.length > 0 ? specs : null,
        city: editForm.city.trim() || null,
        country: editForm.country.trim() || null,
      });
      showToast('Master profile updated', 'success');
      setShowEditModal(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const navigateViewer = (dir: 1 | -1) => {
    setViewerIndex((i) => {
      const next = i + dir;
      if (next < 0) return portfolioImages.length - 1;
      if (next >= portfolioImages.length) return 0;
      return next;
    });
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="max-w-3xl mx-auto text-center py-32 animate-fade-in">
        <p className="text-lg font-medium text-[var(--color-text-secondary)]">Master not found</p>
        <button onClick={() => router.back()} className="btn-outline mt-4 px-5 py-2 text-sm cursor-pointer">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {isOwnProfile && (
        <div className="mb-4 p-3 rounded-[var(--radius-lg)] bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
          You are viewing your own public profile — this is what clients see.
        </div>
      )}

      {/* Hero card */}
      <div className="glass-card p-8 text-center mb-6 relative">
        {/* Owner edit button */}
        {isOwner && !isOwnProfile && (
          <button
            onClick={openEdit}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-brand-pink-dark)] transition-colors cursor-pointer"
            title="Edit master profile"
          >
            <Edit3 size={16} />
          </button>
        )}
        {/* Avatar */}
        <div className="mx-auto mb-4">
          {master.avatar_url ? (
            <img
              src={master.avatar_url}
              alt={master.full_name || 'Master'}
              className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-[var(--color-brand-pink)]/30 shadow-lg"
            />
          ) : (
            <div className="w-28 h-28 rounded-full mx-auto bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] flex items-center justify-center text-white font-bold text-4xl shadow-lg">
              {master.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          {master.full_name || 'Beauty Professional'}
        </h1>

        {(master.city || master.country) && (
          <p className="flex items-center justify-center gap-1 text-sm text-[var(--color-text-secondary)] mb-4">
            <MapPin size={14} className="text-[var(--color-primary)]" />
            {[master.city, master.country].filter(Boolean).join(', ')}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{services.length}</p>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Services</p>
          </div>
          <div className="w-px h-8 bg-[var(--color-border-light)]" />
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-primary)]">{portfolioImages.length}</p>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Photos</p>
          </div>
          {master.years_of_experience != null && master.years_of_experience > 0 && (
            <>
              <div className="w-px h-8 bg-[var(--color-border-light)]" />
              <div className="text-center">
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{master.years_of_experience}</p>
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Years Exp.</p>
              </div>
            </>
          )}
        </div>

        {/* Specialties */}
        {master.specialties && master.specialties.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-5">
            {master.specialties.map((s) => (
              <span
                key={s}
                className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[var(--color-brand-pink)]/10 text-[var(--color-brand-pink-dark)] border border-[var(--color-brand-pink)]/20"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {master.bio && (
          <div className="max-w-md mx-auto p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)]">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed text-center">{master.bio}</p>
          </div>
        )}
      </div>

      {/* Owner-only: Contact & Commission */}
      {isOwner && !isOwnProfile && (
        <div className="glass-card p-6 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Owner Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {master.email && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-light)]">
                <Mail size={16} className="text-[var(--color-text-muted)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Email</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{master.email}</p>
                </div>
              </div>
            )}
            {master.phone && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-light)]">
                <Phone size={16} className="text-[var(--color-text-muted)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Phone</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{master.phone}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-light)]">
              <Percent size={16} className="text-[var(--color-text-muted)] shrink-0" />
              <div>
                <p className="text-[11px] text-[var(--color-text-muted)]">Commission</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">{master.commission_rate != null ? `${master.commission_rate}%` : 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-[var(--color-primary)]" />
          <h2 className="font-semibold text-[var(--color-text-primary)]">Available Services</h2>
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No services available</p>
        ) : (
          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] flex items-center gap-4 hover:border-[var(--color-primary)] transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/booking?serviceId=${svc.id}&masterId=${masterId}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--color-text-primary)]">{svc.name}</p>
                  {svc.description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{svc.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-bold text-[var(--color-primary)]">&euro;{Number(svc.base_price).toFixed(2)}</span>
                    <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Clock size={11} /> {svc.duration_minutes} min
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio gallery */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon size={18} className="text-[var(--color-primary)]" />
          <h2 className="font-semibold text-[var(--color-text-primary)]">Portfolio</h2>
          {portfolioImages.length > 0 && (
            <span className="text-xs text-[var(--color-text-muted)] ml-auto">{portfolioImages.length} photos</span>
          )}
        </div>

        {portfolioImages.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No portfolio photos yet</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {portfolioImages.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => openViewer(index)}
                className="relative rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border-light)] aspect-square cursor-pointer group"
              >
                <img src={photo.image_url} alt={photo.description || 'Portfolio'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {photo.description && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                    <p className="text-white text-[11px] truncate">{photo.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen image viewer */}
      {viewerOpen && portfolioImages.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setViewerOpen(false)}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setViewerOpen(false); }}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 cursor-pointer"
            >
              <X size={20} />
            </button>
            <span className="text-sm text-white/70 font-medium">{viewerIndex + 1} / {portfolioImages.length}</span>
            <div className="w-10" />
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4 relative" onClick={(e) => e.stopPropagation()}>
            {portfolioImages.length > 1 && (
              <button
                onClick={() => navigateViewer(-1)}
                className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer z-10"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <img
              src={portfolioImages[viewerIndex].image_url}
              alt={portfolioImages[viewerIndex].description || ''}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
            {portfolioImages.length > 1 && (
              <button
                onClick={() => navigateViewer(1)}
                className="absolute right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 cursor-pointer z-10"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Caption */}
          {portfolioImages[viewerIndex]?.description && (
            <div className="px-8 py-4 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-white/80 leading-relaxed">
                {portfolioImages[viewerIndex].description}
              </p>
            </div>
          )}
        </div>
      )}
      {/* Owner Edit Modal */}
      {showEditModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Edit Master Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="input-glass w-full resize-none"
                  rows={3}
                  placeholder="Short bio"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">City</label>
                  <input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="input-glass w-full"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Country</label>
                  <input
                    value={editForm.country}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    className="input-glass w-full"
                    placeholder="Country"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={editForm.commission_rate}
                  onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })}
                  className="input-glass w-full"
                  placeholder="e.g. 30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Specialties (comma-separated)</label>
                <input
                  value={editForm.specialties}
                  onChange={(e) => setEditForm({ ...editForm, specialties: e.target.value })}
                  className="input-glass w-full"
                  placeholder="Nails, Lashes, Brows"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary cursor-pointer">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-pink flex items-center gap-2 cursor-pointer disabled:opacity-50">
                {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
