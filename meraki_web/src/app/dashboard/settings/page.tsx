'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { Settings, User, Shield, Save, Loader2, Camera, CreditCard, Mail, Dumbbell, AlertTriangle, X, Briefcase, Image as ImageIcon, Trash2, Plus, ExternalLink } from 'lucide-react';
import BusinessSettingsPanel from '@/components/BusinessSettingsPanel';
import PaymentMethodsManager from '@/components/PaymentMethodsManager';
import type { Tables, Portfolio } from '@/types/database';

const DELETE_PHRASE = 'DELETE MY ACCOUNT';

const baseNavItems = [
  { label: 'Profile', value: 'profile', icon: User },
  { label: 'Security', value: 'security', icon: Shield },
  { label: 'Billing', value: 'billing', icon: CreditCard },
];

const masterNavItems = [
  { label: 'Portfolio', value: 'portfolio', icon: ImageIcon },
  { label: 'Business', value: 'business', icon: Briefcase },
];

const PILATES_DEFAULT_SETTINGS = {
  default_capacity: 6,
  default_session_duration_minutes: 50,
  buffer_minutes: 10,
  equipment_provided: true,
  require_health_declaration: true,
  default_level: 'All levels',
  equipment_notes: '',
  location_notes: '',
};

type PilatesSettingsRow = Tables<'pilates_settings'>;
type PilatesSettingsForm = Pick<
  PilatesSettingsRow,
  'default_capacity' |
  'default_session_duration_minutes' |
  'buffer_minutes' |
  'equipment_provided' |
  'require_health_declaration' |
  'default_level'
> & {
  equipment_notes: string;
  location_notes: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback;
};

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeSection, setActiveSection] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  // Delete account flow
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pilatesSettings, setPilatesSettings] = useState<PilatesSettingsForm>(PILATES_DEFAULT_SETTINGS);
  const [pilatesService, setPilatesService] = useState<Tables<'services'> | null>(null);
  const [loadingPilates, setLoadingPilates] = useState(false);
  const [savingPilates, setSavingPilates] = useState(false);
  // Portfolio state
  const [portfolioImages, setPortfolioImages] = useState<Portfolio[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Portfolio | null>(null);
  const [editPhotoDesc, setEditPhotoDesc] = useState('');
  const [savingPhotoDesc, setSavingPhotoDesc] = useState(false);
  const canManagePilates = profile?.role === 'owner';
  const isMasterOrOwner = profile?.role === 'master' || profile?.role === 'owner';
  const navItems = [
    ...baseNavItems,
    ...(isMasterOrOwner ? masterNavItems : []),
    ...(canManagePilates ? [{ label: 'Pilates', value: 'pilates', icon: Dumbbell }] : []),
  ];

  useEffect(() => {
    if (!profile?.id || !canManagePilates) return;

    let isMounted = true;

    const loadPilatesSettings = async () => {
      setLoadingPilates(true);
      try {
        const { data: serviceData, error: serviceError } = await supabase
          .from('services')
          .select('*')
          .eq('created_by', profile.id)
          .eq('category', 'Pilates')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (serviceError) throw serviceError;
        setPilatesService(serviceData || null);
        if (!serviceData) return;

        const { data, error } = await supabase
          .from('pilates_settings')
          .select('*')
          .eq('service_id', serviceData.id)
          .maybeSingle();

        if (error) throw error;
        if (data && isMounted) {
          setPilatesSettings({
            default_capacity: data.default_capacity ?? PILATES_DEFAULT_SETTINGS.default_capacity,
            default_session_duration_minutes: data.default_session_duration_minutes ?? PILATES_DEFAULT_SETTINGS.default_session_duration_minutes,
            buffer_minutes: data.buffer_minutes ?? PILATES_DEFAULT_SETTINGS.buffer_minutes,
            equipment_provided: data.equipment_provided ?? PILATES_DEFAULT_SETTINGS.equipment_provided,
            require_health_declaration: data.require_health_declaration ?? PILATES_DEFAULT_SETTINGS.require_health_declaration,
            default_level: data.default_level || PILATES_DEFAULT_SETTINGS.default_level,
            equipment_notes: data.equipment_notes || '',
            location_notes: data.location_notes || '',
          });
        }
      } catch (err) {
        console.error('Error loading Pilates settings:', err);
      } finally {
        if (isMounted) setLoadingPilates(false);
      }
    };

    loadPilatesSettings();

    return () => {
      isMounted = false;
    };
  }, [profile?.id, canManagePilates, supabase]);

  // ─── Portfolio data loading ──────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id || !isMasterOrOwner) return;
    let cancelled = false;
    const load = async () => {
      setLoadingPortfolio(true);
      try {
        const { data, error } = await supabase
          .from('portfolios')
          .select('*')
          .eq('master_id', profile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setPortfolioImages(data || []);
      } catch (err) {
        console.error('Error loading portfolio:', err);
      } finally {
        if (!cancelled) setLoadingPortfolio(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.id, isMasterOrOwner, supabase]);

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile?.id) return;

    const maxSize = 5 * 1024 * 1024;
    const validFiles = Array.from(files).filter((f) => {
      if (f.size > maxSize) {
        showToast(`${f.name} exceeds 5 MB limit`, 'error');
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    setUploadingPortfolio(true);
    let successCount = 0;
    try {
      for (const file of validFiles) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(fileName, file, { upsert: false });
        if (uploadError) { console.error('Upload error:', uploadError); continue; }

        const { data: urlData } = supabase.storage.from('portfolios').getPublicUrl(fileName);

        const { error: dbError } = await supabase
          .from('portfolios')
          .insert({ master_id: profile.id, image_url: urlData.publicUrl, description: '' });
        if (dbError) { console.error('DB error:', dbError); continue; }
        successCount++;
      }
      if (successCount > 0) {
        showToast(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded`, 'success');
        // Reload
        const { data } = await supabase
          .from('portfolios')
          .select('*')
          .eq('master_id', profile.id)
          .order('created_at', { ascending: false });
        setPortfolioImages(data || []);
      }
    } catch (err) {
      showToast(getErrorMessage(err, 'Upload failed'), 'error');
    } finally {
      setUploadingPortfolio(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photo: Portfolio) => {
    if (!confirm('Delete this portfolio photo? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('portfolios').delete().eq('id', photo.id);
      if (error) throw error;
      setPortfolioImages((prev) => prev.filter((p) => p.id !== photo.id));
      if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
      showToast('Photo deleted', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to delete photo'), 'error');
    }
  };

  const handleSavePhotoDesc = async () => {
    if (!selectedPhoto) return;
    setSavingPhotoDesc(true);
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({ description: editPhotoDesc.trim() || null })
        .eq('id', selectedPhoto.id);
      if (error) throw error;
      setPortfolioImages((prev) =>
        prev.map((p) => (p.id === selectedPhoto.id ? { ...p, description: editPhotoDesc.trim() || null } : p))
      );
      setSelectedPhoto((prev) => (prev ? { ...prev, description: editPhotoDesc.trim() || null } : null));
      showToast('Description saved', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to save description'), 'error');
    } finally {
      setSavingPhotoDesc(false);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    await updateProfile({
      full_name: String(formData.get('fullName') || ''),
      phone: String(formData.get('phone') || ''),
      bio: String(formData.get('bio') || ''),
      city: String(formData.get('city') || ''),
    });
    showToast('Profile saved successfully!', 'success');
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });
      showToast('Avatar updated successfully', 'success');
    } catch (error: unknown) {
      console.error('Upload error:', error);
      showToast(getErrorMessage(error, 'Error uploading avatar'), 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSendResetEmail = async () => {
    setSendingReset(true);
    try {
      const email = profile?.email;
      if (!email) { showToast('No email found', 'error'); return; }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      showToast('Password reset email sent! Check your inbox.', 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to send reset email'), 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const handleChangeEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    if (profile?.email && trimmed === profile.email.toLowerCase()) {
      showToast('That is already your current email', 'error');
      return;
    }
    setUpdatingEmail(true);
    try {
      // Route confirmation links through our auth callback so PKCE codes are exchanged.
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/dashboard/settings?email_changed=1')}`;
      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        { emailRedirectTo }
      );
      if (error) throw error;
      showToast(
        'Confirmation links sent. Open BOTH emails (old + new) and click the link in each to finish the change.',
        'success'
      );
      setNewEmail('');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to update email'), 'error');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { return_url: window.location.href }
      });

      const errorMessage = error?.message || data?.error || (typeof data === 'string' ? data : null);
      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (data?.url) {
        const urlObj = new URL(data.url);
        if (urlObj.hostname.endsWith('.stripe.com')) {
          window.location.href = data.url;
        } else {
          throw new Error('Security Error: Invalid billing portal URL domain.');
        }
      } else {
        throw new Error(`Invalid response: ${JSON.stringify(data)}`);
      }
    } catch (err: unknown) {
      console.error('Edge Function Error:', err);
      showToast(getErrorMessage(err, 'Failed to open billing portal'), 'error');
      setOpeningPortal(false);
    }
  };

  const handleSavePilates = async () => {
    if (!profile?.id || !canManagePilates) return;
    if (!pilatesService) {
      showToast('Create an active Pilates service before saving Pilates settings.', 'error');
      return;
    }
    setSavingPilates(true);
    try {
      const { error } = await supabase
        .from('pilates_settings')
        .upsert(
          {
            owner_id: profile.id,
            service_id: pilatesService.id,
            ...pilatesSettings,
            equipment_notes: pilatesSettings.equipment_notes.trim() || null,
            location_notes: pilatesSettings.location_notes.trim() || null,
          },
          { onConflict: 'service_id' }
        );

      if (error) throw error;
      showToast('Pilates settings saved successfully!', 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to save Pilates settings'), 'error');
    } finally {
      setSavingPilates(false);
    }
  };

  const openDeleteModal = () => {
    setDeleteOpen(true);
    setDeletePhrase('');
    setDeleteOtp('');
    setDeleteOtpSent(false);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteOpen(false);
  };

  const handleSendDeleteOtp = async () => {
    const email = profile?.email;
    if (!email) {
      showToast('No email on profile — contact support', 'error');
      return;
    }
    if (deletePhrase !== DELETE_PHRASE) {
      showToast(`Type the phrase exactly: ${DELETE_PHRASE}`, 'error');
      return;
    }
    setSendingDeleteOtp(true);
    try {
      // Sends a 6-digit OTP to the user's existing email. shouldCreateUser=false
      // ensures we never accidentally create a new account from this code path.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setDeleteOtpSent(true);
      showToast('Verification code sent. Check your email.', 'success');
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to send verification code'), 'error');
    } finally {
      setSendingDeleteOtp(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletePhrase !== DELETE_PHRASE) {
      showToast(`Type the phrase exactly: ${DELETE_PHRASE}`, 'error');
      return;
    }
    if (!/^\d{6}$/.test(deleteOtp.trim())) {
      showToast('Enter the 6-digit code from your email', 'error');
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { otp: deleteOtp.trim(), phrase: deletePhrase },
      });
      const errorMessage =
        error?.message || data?.error || (typeof data === 'string' ? data : null);
      if (errorMessage) throw new Error(errorMessage);
      if (!data?.success) throw new Error('Unexpected response from server');

      showToast('Account deleted. Goodbye.', 'success');
      await signOut();
      router.replace('/');
    } catch (err: unknown) {
      console.error('Delete account error:', err);
      showToast(getErrorMessage(err, 'Failed to delete account'), 'error');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={22} className="text-[var(--color-text-muted)]" />
          <h1 className="text-3xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
        </div>
        <p className="text-[var(--color-text-secondary)]">Manage your preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveSection(item.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium transition-all cursor-pointer ${
                    activeSection === item.value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)]'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeSection === 'profile' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">Profile Settings</h2>
              {/* Avatar */}
              <div className="flex items-center gap-5 mb-8">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover shadow-sm border border-[var(--color-border-light)]" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] flex items-center justify-center text-white font-bold text-2xl">
                      {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform"
                    title="Change avatar"
                  >
                    {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={14} />}
                  </label>
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{profile?.full_name || 'Your Name'}</p>
                  <p className="text-sm text-[var(--color-text-muted)] capitalize">{profile?.role || 'client'} account</p>
                </div>
              </div>

              <form key={profile?.id || 'profile-form'} onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="label-upper">Full Name</label>
                  <input type="text" name="fullName" defaultValue={profile?.full_name || ''} className="input-glass" />
                </div>
                <div>
                  <label className="label-upper">Email</label>
                  <input type="email" value={profile?.email || ''} disabled className="input-glass opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">To change your email, go to the Security tab.</p>
                </div>
                <div>
                  <label className="label-upper">Phone</label>
                  <input type="tel" name="phone" defaultValue={profile?.phone || ''} className="input-glass" placeholder="+44..." />
                </div>
                <div>
                  <label className="label-upper">City</label>
                  <input type="text" name="city" defaultValue={profile?.city || ''} className="input-glass" placeholder="London" />
                </div>
                <div>
                  <label className="label-upper">Bio</label>
                  <textarea name="bio" defaultValue={profile?.bio || ''} rows={3} className="input-glass resize-none" placeholder="Tell us about yourself..." />
                </div>
                <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-6 py-3 text-sm cursor-pointer">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>

              {isMasterOrOwner && profile?.id && (
                <div className="mt-6 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-primary)]">Public Profile</p>
                    <p className="text-xs text-[var(--color-text-muted)]">See what clients see when they view your profile</p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/masters/${profile.id}`)}
                    className="btn-outline text-sm px-4 py-2 border-slate-300 flex items-center gap-2 cursor-pointer"
                  >
                    <ExternalLink size={14} /> View Public Profile
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'security' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">Security Settings</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)]">
                  <h3 className="font-medium text-sm text-[var(--color-text-primary)] mb-1">Change Email Address</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">You will need to verify both your old and new email.</p>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] border-0" />
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email address"
                        className="input-glass w-full"
                        style={{ paddingLeft: '38px', paddingRight: '12px' }}
                      />
                    </div>
                    <button
                      onClick={handleChangeEmail}
                      disabled={updatingEmail || !newEmail}
                      className="btn-primary text-sm px-4 py-2.5 whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-0"
                    >
                      {updatingEmail ? <><Loader2 size={14} className="animate-spin" /> Verifying...</> : 'Update Email'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)]">
                  <h3 className="font-medium text-sm text-[var(--color-text-primary)] mb-1">Change Password</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">Update your password securely via email reset link</p>
                  <button
                    onClick={handleSendResetEmail}
                    disabled={sendingReset}
                    className="btn-outline mt-3 text-sm px-5 py-2.5 cursor-pointer flex items-center gap-2 border-slate-300"
                  >
                    {sendingReset ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : 'Send Password Reset Email'}
                  </button>
                </div>

                <div className="p-4 rounded-[var(--radius-lg)] bg-red-50 mt-8 border border-red-100">
                  <h3 className="font-medium text-sm text-red-600 mb-1">Danger Zone</h3>
                  <p className="text-xs text-red-500 mb-3">Permanently delete your account and all associated data. We&apos;ll require a confirmation phrase and a 6-digit code emailed to you.</p>
                  <button
                    onClick={openDeleteModal}
                    className="text-xs px-4 py-2 rounded-[var(--radius-md)] border border-red-300 text-red-600 font-semibold hover:bg-red-100 transition-colors cursor-pointer bg-white"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">Billing & Payments</h2>
              <PaymentMethodsManager />
              <div className="mt-6 pt-5 border-t border-[var(--color-border-light)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-[var(--color-text-primary)]">Stripe Billing Portal</p>
                    <p className="text-xs text-[var(--color-text-muted)]">View invoices, receipts, and manage subscriptions</p>
                  </div>
                  <button
                    onClick={handleOpenBillingPortal}
                    disabled={openingPortal}
                    className="btn-outline text-sm px-5 py-2 border-slate-300 flex items-center gap-2 cursor-pointer"
                  >
                    {openingPortal ? <><Loader2 size={16} className="animate-spin" /> Opening...</> : <><ExternalLink size={14} /> Billing Portal</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'portfolio' && isMasterOrOwner && (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Portfolio</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Showcase your best work to attract clients</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">{portfolioImages.length} photo{portfolioImages.length !== 1 ? 's' : ''}</span>
                  <input
                    type="file"
                    id="portfolio-upload"
                    accept="image/*"
                    multiple
                    onChange={handlePortfolioUpload}
                    disabled={uploadingPortfolio}
                    className="hidden"
                  />
                  <label
                    htmlFor="portfolio-upload"
                    className="btn-primary text-sm px-4 py-2 flex items-center gap-2 cursor-pointer"
                  >
                    {uploadingPortfolio ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {uploadingPortfolio ? 'Uploading...' : 'Add Photos'}
                  </label>
                </div>
              </div>

              {loadingPortfolio ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
                </div>
              ) : portfolioImages.length === 0 ? (
                <div className="text-center py-16">
                  <ImageIcon size={48} className="mx-auto text-[var(--color-text-muted)] mb-3" />
                  <p className="font-medium text-[var(--color-text-secondary)] mb-1">No portfolio photos yet</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Upload photos to showcase your work to clients</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {portfolioImages.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border-light)] aspect-[4/5] cursor-pointer"
                      onClick={() => { setSelectedPhoto(photo); setEditPhotoDesc(photo.description || ''); }}
                    >
                      <img src={photo.image_url} alt={photo.description || 'Portfolio'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-white text-xs font-medium">View</span>
                      </div>
                      {photo.description && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                          <p className="text-white text-[10px] truncate">{photo.description}</p>
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photo detail / description modal */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setSelectedPhoto(null)}
            >
              <div
                className="glass-card max-w-lg w-full p-0 relative animate-fade-in overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer hover:bg-black/70"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
                <img src={selectedPhoto.image_url} alt={selectedPhoto.description || 'Portfolio'} className="w-full max-h-[50vh] object-contain bg-black/5" />
                <div className="p-5">
                  <label className="label-upper">Description</label>
                  <textarea
                    value={editPhotoDesc}
                    onChange={(e) => setEditPhotoDesc(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="input-glass resize-none mb-1"
                    placeholder="Add a description for this work..."
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-muted)]">{editPhotoDesc.length}/500</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeletePhoto(selectedPhoto)}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-3 py-2 cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                      <button
                        onClick={handleSavePhotoDesc}
                        disabled={savingPhotoDesc || (editPhotoDesc.trim() || '') === (selectedPhoto.description || '')}
                        className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {savingPhotoDesc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'business' && isMasterOrOwner && (
            <BusinessSettingsPanel />
          )}

          {activeSection === 'pilates' && canManagePilates && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Pilates Booking Settings</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">Configure session-specific details clients see when booking Pilates.</p>
              {loadingPilates ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <Loader2 size={16} className="animate-spin" />
                  Loading Pilates settings...
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label-upper">Default Capacity</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={pilatesSettings.default_capacity}
                        onChange={(e) => setPilatesSettings({ ...pilatesSettings, default_capacity: Number(e.target.value) })}
                        className="input-glass"
                      />
                    </div>
                    <div>
                      <label className="label-upper">Session Duration</label>
                      <input
                        type="number"
                        min="15"
                        max="240"
                        value={pilatesSettings.default_session_duration_minutes}
                        onChange={(e) => setPilatesSettings({ ...pilatesSettings, default_session_duration_minutes: Number(e.target.value) })}
                        className="input-glass"
                      />
                    </div>
                    <div>
                      <label className="label-upper">Buffer Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={pilatesSettings.buffer_minutes}
                        onChange={(e) => setPilatesSettings({ ...pilatesSettings, buffer_minutes: Number(e.target.value) })}
                        className="input-glass"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-upper">Default Level</label>
                    <select
                      value={pilatesSettings.default_level}
                      onChange={(e) => setPilatesSettings({ ...pilatesSettings, default_level: e.target.value })}
                      className="input-glass"
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                      <option>All levels</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] cursor-pointer">
                      <span>
                        <span className="block font-semibold text-sm text-[var(--color-text-primary)]">Equipment Provided</span>
                        <span className="block text-xs text-[var(--color-text-muted)] mt-1">Mats, rings, blocks, reformers, or other studio equipment</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={pilatesSettings.equipment_provided}
                        onChange={(e) => setPilatesSettings({ ...pilatesSettings, equipment_provided: e.target.checked })}
                        className="h-5 w-5 accent-[var(--color-primary)]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-4 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-light)] border border-[var(--color-border-light)] cursor-pointer">
                      <span>
                        <span className="block font-semibold text-sm text-[var(--color-text-primary)]">Health Declaration</span>
                        <span className="block text-xs text-[var(--color-text-muted)] mt-1">Ask clients to confirm they are fit to join Pilates sessions</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={pilatesSettings.require_health_declaration}
                        onChange={(e) => setPilatesSettings({ ...pilatesSettings, require_health_declaration: e.target.checked })}
                        className="h-5 w-5 accent-[var(--color-primary)]"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="label-upper">Equipment Notes</label>
                    <textarea
                      value={pilatesSettings.equipment_notes}
                      onChange={(e) => setPilatesSettings({ ...pilatesSettings, equipment_notes: e.target.value })}
                      rows={3}
                      className="input-glass resize-none"
                      placeholder="Tell clients what to bring or what is provided..."
                    />
                  </div>

                  <div>
                    <label className="label-upper">Location Notes</label>
                    <textarea
                      value={pilatesSettings.location_notes}
                      onChange={(e) => setPilatesSettings({ ...pilatesSettings, location_notes: e.target.value })}
                      rows={3}
                      className="input-glass resize-none"
                      placeholder="Studio room, access instructions, parking, or arrival guidance..."
                    />
                  </div>

                  <button onClick={handleSavePilates} disabled={savingPilates} className="btn-primary flex items-center gap-2 px-6 py-3 text-sm cursor-pointer">
                    {savingPilates ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {savingPilates ? 'Saving...' : 'Save Pilates Settings'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={closeDeleteModal}
        >
          <div
            className="glass-card max-w-md w-full p-6 relative animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeDeleteModal}
              disabled={deleting}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5 cursor-pointer disabled:opacity-40"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Delete your account?
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  This is permanent. All bookings, services, messages, and personal data tied to{' '}
                  <span className="font-semibold">{profile?.email}</span> will be erased.
                </p>
              </div>
            </div>

            {/* Step 1: phrase */}
            <div className="mt-5">
              <label className="label-upper">
                Type <span className="font-mono text-red-600">{DELETE_PHRASE}</span> to confirm
              </label>
              <input
                type="text"
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                disabled={deleting}
                className="input-glass font-mono"
                placeholder={DELETE_PHRASE}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Step 2: OTP */}
            {deleteOtpSent && (
              <div className="mt-4 animate-fade-in">
                <label className="label-upper">6-digit code from email</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={deleteOtp}
                  onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={deleting}
                  className="input-glass font-mono tracking-[0.3em] text-center"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
            )}

            <div className="flex flex-col gap-2 mt-6">
              {!deleteOtpSent ? (
                <button
                  onClick={handleSendDeleteOtp}
                  disabled={sendingDeleteOtp || deletePhrase !== DELETE_PHRASE}
                  className="w-full h-11 rounded-[var(--radius-lg)] bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingDeleteOtp ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {sendingDeleteOtp ? 'Sending code…' : 'Send 6-digit code to my email'}
                </button>
              ) : (
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting || deletePhrase !== DELETE_PHRASE || deleteOtp.length !== 6}
                  className="w-full h-11 rounded-[var(--radius-lg)] bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  {deleting ? 'Deleting account…' : 'Permanently delete my account'}
                </button>
              )}

              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="w-full h-10 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-white text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-light)] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
